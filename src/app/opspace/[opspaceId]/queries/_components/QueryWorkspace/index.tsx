'use client';

import type { UUIDv7 }              from '@Types/primitives';
import type { SQLEditorHandle }     from '../SQLEditor';

import {
  useCallback, useEffect, useEffectEvent,
  useMemo, useRef, useState,
  Suspense
}                                   from 'react';
import dynamic                      from 'next/dynamic';

import { useReduxSelector }         from '@Redux/storeHooks';
import {
  selectDataQueryIdForTabId,
  selectTabIds,
  selectActiveTabId
}                                   from '@Redux/records/tabbar';
import { selectDataQueryRecord }    from '@Redux/records/dataQuery';

import { useQueriesRoute }          from '../../_providers/QueriesRouteProvider';
import OpSpaceIntro                 from '../../../_components/OpSpaceIntro';
import TabBar                       from './TabBar';
import Toolbar                      from './Toolbar';
import SplitPane                    from './SplitPane';
import {
  STORAGE_KEY_SPLIT,
  STORAGE_KEY_LAST_VISITED
}                                   from '@Constants';
import styles                       from './styles.module.css';


// AIDEV-NOTE: SQLEditor/QueryResults are heavy + browser-only. Load client-side with an in-panel fallback.
const SQLEditor = dynamic(() => import('../SQLEditor'), {
  ssr: false,
  loading: () => (<div className={styles['tabpanel']}>Loading editor…</div>)
});
const QueryResults = dynamic(() => import('../QueryResults'), {
  ssr: false,
  loading: () => (<div className={styles['tabpanel']}>Loading results…</div>)
});

function QueryWorkspace() {
  const {
    opspaceId,
    routeMode,
    dataQueryId: routeDataQueryId
  }                             = useQueriesRoute();

  const editorRef                = useRef<SQLEditorHandle | null>(null);
  const containerRef             = useRef<HTMLDivElement  | null>(null);
  const topPanelRef              = useRef<HTMLDivElement  | null>(null);
  const bottomPanelRef           = useRef<HTMLDivElement  | null>(null);
  const lastActiveDataQueryIdRef = useRef<string | null>(null);

  const tabIds                    = useReduxSelector(selectTabIds);
  const activeTabId               = useReduxSelector(selectActiveTabId);
  const activeDataQueryIdFromTabs = useReduxSelector(
    selectDataQueryIdForTabId,
    (activeTabId || null) as UUIDv7 | null
  );

  // AIDEV-NOTE: Prefer tab-derived dataQueryId; fallback to the route segment on first load (deep links).
  const activeDataQueryId       = (activeDataQueryIdFromTabs || routeDataQueryId || '') as string;
  const activeDataQueryRecord   = useReduxSelector(selectDataQueryRecord, activeDataQueryId);

  // AIDEV-NOTE: Split ratio is local state; persist it only on drag commit.
  const [topRatio, setTopRatio] = useState<number>(0.5);
  const topStyle                = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle             = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);

  // AIDEV-NOTE: When switching queries, CodeMirror receives a new `value`. Suppress SQLEditor's debounced Redux write on that "programmatic" update.
  const isHydratingText         = lastActiveDataQueryIdRef.current !== activeDataQueryId;
  lastActiveDataQueryIdRef.current = activeDataQueryId;

  // AIDEV-NOTE: Restore split ratio from localStorage after mount.
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

  // AIDEV-NOTE: Mod/Ctrl+Enter runs the current query. useEffectEvent keeps the listener stable.
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

  // AIDEV-NOTE: Persist last visited opspace/query so the root page can offer a "resume" link (saved queries only).
  useEffect(() => {
    try {
      const payload =
        routeMode === 'saved'
          ? {
              opspaceId,
              routeMode,                    // 'saved'
              dataQueryId: activeDataQueryId || null,
              v: 2,
              updatedAt: new Date().toISOString()
            }
          : {
              opspaceId,
              routeMode,                    // 'new'
              // AIDEV-NOTE: For /queries/new we intentionally don't pin a specific dataQueryId;
              // restoration within the OpSpace prefers lastActiveUnsavedTabId + /queries/new.
              dataQueryId: null,
              v: 2,
              updatedAt: new Date().toISOString()
            };

      window.localStorage.setItem(
        STORAGE_KEY_LAST_VISITED,
        JSON.stringify(payload)
      );
    } catch {}
  }, [opspaceId, routeMode, activeDataQueryId]);

  const getCurrentEditorText = useCallback(() => {
    return editorRef.current?.getCurrentText() || '';
  }, []);

  const activeIndex = Math.max(0, tabIds.findIndex((t) => t === (activeTabId || '')));
  const activeTab   = tabIds[activeIndex] || tabIds[0];
  const hasAnyTabs  = tabIds.length > 0;
  const isNewRoute  = routeMode === 'new';

  const runFromToolbar = useCallback(() => {
    editorRef.current?.runCurrentQuery();
  }, []);

  return (
    <div className={styles['query-workspace']} ref={containerRef}>
      <TabBar />

      <div
        id={hasAnyTabs ? `panel-${activeTab}` : 'panel-empty'}
        role="tabpanel"
        aria-labelledby={hasAnyTabs ? `tab-${activeTab}` : undefined}
        className={styles['tabpanel']}
      >
        {hasAnyTabs ? (
          <>
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
          </>
        ) : (
          // AIDEV-NOTE: Empty-state: on `/queries/new` show the OpSpaceIntro hero; otherwise show a minimal placeholder.
          isNewRoute ? (
            <OpSpaceIntro />
          ) : (
            <div className={styles['history-placeholder']}>
              <div className={styles['history-text']}>
                <p>No tabs open in this workspace.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}


export default QueryWorkspace;
