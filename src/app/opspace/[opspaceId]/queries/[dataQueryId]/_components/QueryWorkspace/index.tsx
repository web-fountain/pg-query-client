'use client';

import type { UUIDv7 }              from '@Types/primitives';
import type { SQLEditorHandle }     from '../SQLEditor';

import {
  useCallback, useEffect, useEffectEvent,
  useMemo, useRef, useState,
  useTransition, Suspense
}                                   from 'react';
import { useRouter }                from 'next/navigation';
import dynamic                      from 'next/dynamic';

import {
  useReduxDispatch,
  useReduxSelector
}                                   from '@Redux/storeHooks';
import {
  selectDataQueryIdForTabId,
  selectTabIds,
  selectActiveTabId
}                                   from '@Redux/records/tabbar';
import {
  setDataQueryRecord,
  selectDataQueryRecord,
}                                   from '@Redux/records/dataQuery';

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
    dataQueryId: initialActiveId
  }                             = useOpSpaceRoute();

  const router                  = useRouter();
  const editorRef               = useRef<SQLEditorHandle | null>(null);
  const containerRef            = useRef<HTMLDivElement  | null>(null);
  const topPanelRef             = useRef<HTMLDivElement  | null>(null);
  const bottomPanelRef          = useRef<HTMLDivElement  | null>(null);
  const isLoadingContent        = useRef(false);      // track if we're loading content to prevent dispatch during programmatic hydration
  const lastUserInputAtRef      = useRef<number>(0);  // gate restore-on-empty to avoid racing user edits
  const allowRestoreUntilRef    = useRef<number>(0);  // gate restore-on-empty to avoid racing user edits

  const tabIds                  = useReduxSelector(selectTabIds);
  const activeTabId             = useReduxSelector(selectActiveTabId);
  const activeDataQueryIdFromTabs = useReduxSelector(selectDataQueryIdForTabId, (activeTabId || null) as UUIDv7 | null);
  const activeDataQueryId       = (activeDataQueryIdFromTabs || initialActiveId || '') as string;
  const activeDataQueryRecord   = useReduxSelector(selectDataQueryRecord, activeDataQueryId);
  const dispatch                = useReduxDispatch();

  const [topRatio, setTopRatio] = useState<number>(0.5);    // split ratio is local; we persist only on commit.
  const topStyle                = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle             = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);
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
      window.localStorage.setItem(
        STORAGE_KEY_LAST_VISITED,
        JSON.stringify({
          opspaceId,
          dataQueryId: activeDataQueryId || null,
          v: 1,
          updatedAt: Date.now()
        })
      );
    } catch {}
  }, [opspaceId, activeDataQueryId]);

  useEffect(() => {
    // AIDEV-NOTE: Hydrate editor only on active tab changes.
    if (!activeTabId) return;
    // Redux is the source of truth for query text; SQLEditor receives value from Redux.
    isLoadingContent.current = true;
    // Allow restore within a short window after hydration
    allowRestoreUntilRef.current = Date.now() + 1500;
    setTimeout(() => { isLoadingContent.current = false; }, 200);
  }, [activeTabId]);

  const getCurrentEditorText = useCallback(() => {
    return editorRef.current?.getCurrentText() || '';
  }, []);

  const activeIndex = Math.max(0, tabIds.findIndex((t) => t === (activeTabId || '')));
  const activeTab   = tabIds[activeIndex] || tabIds[0];

  const editorOnChange = useEvent((text: string) => {
    if (isLoadingContent.current) return;
    lastUserInputAtRef.current = Date.now();
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
                suppressDispatch={isLoadingContent.current}
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
