'use client';

import type { UUIDv7 }              from '@Types/primitives';
import type { SQLEditorHandle }     from '../SQLEditor';

import {
  useCallback, useEffect, useEffectEvent,
  useMemo, useRef, useState,
  Suspense
}                                   from 'react';
import dynamic                      from 'next/dynamic';

import {
  useReduxDispatch,
  useReduxSelector
}                                   from '@Redux/storeHooks';
import {
  selectDataQueryIdForTabId,
  selectTabIds,
  selectActiveTabId,
  selectLastActiveUnsavedTabId
}                                   from '@Redux/records/tabbar';
import {
  selectDataQueryRecord
}                                   from '@Redux/records/dataQuery';
import { selectNextUntitledName }   from '@Redux/records/unsavedQueryTree';
import { createNewUnsavedDataQueryThunk } from '@Redux/records/dataQuery/thunks';
import { generateUUIDv7 }                from '@Utils/generateId';

import { useOpSpaceRoute }          from '../../_providers/OpSpaceRouteProvider';

import TabBar                       from './TabBar';
import Toolbar                      from './Toolbar';
import SplitPane                    from './SplitPane';
import { useEvent }                 from './hooks/useEvent';
import {
  STORAGE_KEY_SPLIT,
  STORAGE_KEY_LAST_VISITED
}                                   from '@Constants';
import styles                       from './styles.module.css';


// AIDEV-NOTE: Dynamic import heavy client components; provide loading fallback
const SQLEditor = dynamic(() => import('../SQLEditor'), {
  ssr: false,
  loading: () => (<div className={styles['tabpanel']}>Loading editor…</div>)
});
const QueryResults = dynamic(() => import('../QueryResults'), {
  ssr: false,
  loading: () => (<div className={styles['tabpanel']}>Loading results…</div>)
});

// AIDEV-NOTE: SQLEditor is large; if initial TTI needs improvement, consider next/dynamic.
function QueryWorkspace() {
  const {
    opspaceId,
    routeMode,
    dataQueryId: routeDataQueryId
  }                             = useOpSpaceRoute();
  const dispatch                = useReduxDispatch();

  const editorRef                = useRef<SQLEditorHandle | null>(null);
  const containerRef             = useRef<HTMLDivElement  | null>(null);
  const topPanelRef              = useRef<HTMLDivElement  | null>(null);
  const bottomPanelRef           = useRef<HTMLDivElement  | null>(null);
  const isLoadingContent         = useRef(false);      // track if we're loading content to prevent dispatch during programmatic hydration
  const hasCreatedInitialUnsaved = useRef(false);
  const lastActiveDataQueryIdRef = useRef<string | null>(null);

  const tabIds                   = useReduxSelector(selectTabIds);
  const activeTabId              = useReduxSelector(selectActiveTabId);
  const activeDataQueryIdFromTabs = useReduxSelector(selectDataQueryIdForTabId, (activeTabId || null) as UUIDv7 | null);
  const lastActiveUnsavedTabId   = useReduxSelector(selectLastActiveUnsavedTabId);
  const nextUntitledName         = useReduxSelector(selectNextUntitledName);

  // AIDEV-NOTE: Prefer the dataQueryId derived from the active tab once tab
  // state has hydrated from SSR. Fallback to the route segment
  // (routeDataQueryId) on initial load so deep links still work.
  const activeDataQueryId       = (activeDataQueryIdFromTabs || routeDataQueryId || '') as string;
  const activeDataQueryRecord   = useReduxSelector(selectDataQueryRecord, activeDataQueryId);

  const [topRatio, setTopRatio] = useState<number>(0.5);    // split ratio is local; we persist only on commit.
  const topStyle                = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle             = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);

  // AIDEV-NOTE: Treat the first render after an activeDataQueryId change as a
  // hydration pass for SQLEditor. We suppress debounced writes during this
  // render so that programmatic document loads (e.g., switching tabs between
  // saved/unsaved queries) do not dispatch updateDataQueryText actions.
  const isHydratingText         = lastActiveDataQueryIdRef.current !== activeDataQueryId;
  lastActiveDataQueryIdRef.current = activeDataQueryId;

  // AIDEV-NOTE: If on /queries/new and no unsaved tab exists yet, create one.
  // With tabs preloaded on the server, this runs against the true tabs state
  // on first render and avoids creating an extra unsaved tab on refresh when
  // unsaved tabs already exist.
  useEffect(() => {
    if (hasCreatedInitialUnsaved.current) return;
    if (routeMode !== 'new') return;

    // If there's an active data query from tabs, do not create a new one.
    if (activeDataQueryIdFromTabs) {
      hasCreatedInitialUnsaved.current = true;
      return;
    }

    // If there's a known last active unsaved tab that OpSpaceRouteProvider will
    // align to, avoid creating another unsaved query and let alignment happen.
    if (lastActiveUnsavedTabId) {
      hasCreatedInitialUnsaved.current = true;
      return;
    }

    const dataQueryId = generateUUIDv7();
    dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));
    hasCreatedInitialUnsaved.current = true;
  }, [routeMode, activeDataQueryIdFromTabs, lastActiveUnsavedTabId, dispatch, nextUntitledName]);

  // Hydrate ratio from localStorage after mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SPLIT);
      if (raw) {
        const parsed = JSON.parse(raw);
        const r = Number(parsed?.ratio);
        if (!Number.isNaN(r) && r > 0 && r < 1) setTopRatio(r);
      }
    } catch {}
  }, []);

  // AIDEV-NOTE: Keyboard shortcuts for run. Use React 19.2 useEffectEvent to avoid effect re-runs
  const onHotkey = useEffectEvent((e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    if (e.key.toLowerCase() === 'enter') {
      e.preventDefault();
      editorRef.current?.runCurrentQuery();
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onHotkey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // AIDEV-NOTE: Persist last visited location for root page resume behavior
  useEffect(() => {
    try {
      const payload =
        routeMode === 'saved'
          ? {
              opspaceId,
              routeMode,                    // 'saved'
              dataQueryId: activeDataQueryId || null,
              v: 2,
              updatedAt: Date.now()
            }
          : {
              opspaceId,
              routeMode,                    // 'new'
              // AIDEV-NOTE: For /queries/new we don't pin a specific dataQueryId here;
              // restoration should use lastActiveUnsavedTabId + /queries/new.
              dataQueryId: null,
              v: 2,
              updatedAt: Date.now()
            };

      window.localStorage.setItem(
        STORAGE_KEY_LAST_VISITED,
        JSON.stringify(payload)
      );
    } catch {}
  }, [opspaceId, routeMode, activeDataQueryId]);

  useEffect(() => {
    // AIDEV-NOTE: Hydrate editor only on active tab changes.
    if (!activeTabId) return;
    // Redux is the source of truth for query text; SQLEditor receives value from Redux.
    isLoadingContent.current = true;
    // Allow restore within a short window after hydration
    setTimeout(() => { isLoadingContent.current = false; }, 200);
  }, [activeTabId]);

  const getCurrentEditorText = useCallback(() => {
    return editorRef.current?.getCurrentText() || '';
  }, []);

  const activeIndex = Math.max(0, tabIds.findIndex((t) => t === (activeTabId || '')));
  const activeTab   = tabIds[activeIndex] || tabIds[0];

  const editorOnChange = useEvent((text: string) => {
    if (isLoadingContent.current) return;
  });

  const runFromToolbar = useCallback(() => {
    editorRef.current?.runCurrentQuery();
  }, []);

  return (
    <div className={styles['query-workspace']} ref={containerRef}>
      {/* Tabs bar */}
      <TabBar />

      {/* Active tabpanel wrapping toolbar and content */}
      <div
        id={activeTab ? `panel-${activeTab}` : 'panel-empty'}
        role="tabpanel"
        aria-labelledby={activeTab ? `tab-${activeTab}` : undefined}
        className={styles['tabpanel']}
        style={{ display: activeTab ? 'contents' : 'none' }}
      >
        {/* Toolbar within the active tab panel */}
        <Toolbar
          key={activeDataQueryId}
          dataQueryId={activeDataQueryId as UUIDv7}
          onRun={runFromToolbar}
          getCurrentEditorText={getCurrentEditorText}
        />

        <SplitPane
          top={(
            <Suspense fallback={<div className={styles['tabpanel']}>Loading editor…</div>}>
              <SQLEditor
                editorRef={editorRef}
                onChange={editorOnChange}
                value={(activeDataQueryRecord?.current?.queryText || '') as string}
                suppressDispatch={isHydratingText}
              />
            </Suspense>
          )}
          bottom={(
            <Suspense fallback={<div className={styles['tabpanel']}>Loading results…</div>}>
              <QueryResults />
            </Suspense>
          )}
          topStyle={topStyle}
          bottomStyle={bottomStyle}
          topRef={topPanelRef}
          bottomRef={bottomPanelRef}
          containerRef={containerRef as React.RefObject<HTMLElement | null>}
          getRatio={() => topRatio}
          onChangeImmediate={(r) => {
            const topPct = Math.round(r * 100);
            const bottomPct = Math.round((1 - r) * 100);
            const topEl = topPanelRef.current;
            const botEl = bottomPanelRef.current;
            if (topEl) topEl.style.height = `${topPct}%`;
            if (botEl) botEl.style.height = `${bottomPct}%`;
          }}
          onCommit={(r) => {
            setTopRatio(r);
            try { window.localStorage.setItem(STORAGE_KEY_SPLIT, JSON.stringify({ ratio: r })); } catch {}
          }}
        />
      </div>
    </div>
  );
}


export default QueryWorkspace;
