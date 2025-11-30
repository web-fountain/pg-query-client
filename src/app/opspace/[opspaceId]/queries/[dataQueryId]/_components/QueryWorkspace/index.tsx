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
import { rehydrateUrl }             from '@Redux/records/url';
import {
  focusTabIndex     as focusTabIndexAction,
  selectTabEntities,
  selectDataQueryIdForTabId,
  selectTabIds,
  selectActiveTabId,
  selectFocusedTabIndex,
  reorderTabs
}                                   from '@Redux/records/tabbar';
import { closeTabThunk, setActiveTabThunk }        from '@Redux/records/tabbar/thunks';
import {
  setDataQueryRecord,
  selectDataQueryRecord,
  selectDataQueries
}                                   from '@Redux/records/dataQuery';
import { createNewUnsavedDataQueryThunk } from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }        from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                 from '@Utils/generateId';

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
  const tabButtonRefs           = useRef<Array<HTMLButtonElement | null>>([]);
  const isLoadingContent        = useRef(false);      // track if we're loading content to prevent dispatch during programmatic hydration
  const lastUserInputAtRef      = useRef<number>(0);  // gate restore-on-empty to avoid racing user edits
  const allowRestoreUntilRef    = useRef<number>(0);  // gate restore-on-empty to avoid racing user edits

  const tabEntities             = useReduxSelector(selectTabEntities);
  const tabIds                  = useReduxSelector(selectTabIds);
  const activeTabId             = useReduxSelector(selectActiveTabId);
  const focusedTabIndex         = useReduxSelector(selectFocusedTabIndex);
  const activeDataQueryIdFromTabs = useReduxSelector(selectDataQueryIdForTabId, (activeTabId || null) as UUIDv7 | null);
  const activeDataQueryId       = (activeDataQueryIdFromTabs || initialActiveId || '') as string;
  const activeDataQueryRecord   = useReduxSelector(selectDataQueryRecord, activeDataQueryId);
  const dataQueryRecords        = useReduxSelector(selectDataQueries);
  const nextUntitledName        = useReduxSelector(selectNextUntitledName);
  const dispatch                = useReduxDispatch();

  const [topRatio, setTopRatio] = useState<number>(0.5);    // split ratio is local; we persist only on commit.
  const topStyle                = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle             = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);
  const [
    isPendingTabTransition,
    startTabTransition
  ]                             = useTransition();

  const tabsForBar = useMemo(() => {
    return (tabIds as Array<UUIDv7>).map((t) => {
      const tab = tabEntities[t];
      const dataQueryId = tab?.mountId;
      const rec = dataQueryId ? dataQueryRecords?.[dataQueryId] : undefined;
      const name = (rec?.current?.name as string) || (rec?.persisted?.name as string) || 'Untitled';
      return { dataQueryId: (dataQueryId || t) as UUIDv7, tabId: t, name };
    });
  }, [tabIds, tabEntities, dataQueryRecords]);

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

  // AIDEV-NOTE: Keyboard shortcuts for run/save.
  useEffect(() => {
    // Rehydrate route into Redux on first mount
    dispatch(rehydrateUrl({ opspaceId, dataQueryId: initialActiveId }));
  }, [dispatch, opspaceId, initialActiveId]);

  // AIDEV-NOTE: Keep DOM focus synced with Redux roving tabindex to avoid double-click behavior
  useEffect(() => {
    const count = (tabIds as Array<UUIDv7>).length;
    if (count === 0) return;
    const clamped = (((focusedTabIndex || 0) % count) + count) % count;
    const btn = tabButtonRefs.current[clamped] || null;
    try { btn?.focus(); } catch {}
  }, [focusedTabIndex, tabIds]);

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

  // AIDEV-NOTE: Do not push nameDraft to saved tabs until explicit Save is clicked
  const handleTabClick = useCallback((tab: { dataQueryId: UUIDv7; tabId: UUIDv7; name: string }) => {
    const { dataQueryId, tabId } = tab;
    if (tabId === (activeTabId || null)) return;

    dispatch(setActiveTabThunk(tabId))

    // Defer navigation by one frame to allow Redux state to render before route remount
    requestAnimationFrame(() => {
      router.replace(`/opspace/${opspaceId}/queries/${dataQueryId}`);
    });
  }, [opspaceId, router, dispatch, activeTabId]);

  const handleTablistKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabIds.length === 0) return;
    const key = e.key;
    if (key === 'ArrowRight') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: (focusedTabIndex || 0) + 1 }));
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: (focusedTabIndex || 0) - 1 }));
    } else if (key === 'Home') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: 0 }));
    } else if (key === 'End') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: tabIds.length - 1 }));
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
     const safeFocused = focusedTabIndex ?? 0;
     const nextTabId = tabIds[(safeFocused + tabIds.length) % tabIds.length] as UUIDv7 | undefined;
     if (!nextTabId || nextTabId === (activeTabId || null)) return;

     const nextTab = tabEntities[nextTabId];
     const nextDataQueryId = (nextTab?.mountId || initialActiveId) as UUIDv7 | undefined;
     if (!nextDataQueryId) return;

     // Keep Redux and server in sync with the new active tab
     dispatch(setActiveTabThunk(nextTabId));

     // Navigate by dataQueryId (query identity), not tabId
     router.replace(`/opspace/${opspaceId}/queries/${nextDataQueryId}`);
    }
  }, [tabIds.length, focusedTabIndex, dispatch, opspaceId, router]);

  const activeIndex = Math.max(0, tabIds.findIndex((t) => t === (activeTabId || '')));
  const activeTab   = tabIds[activeIndex] || tabIds[0];

  const editorOnChange = useEvent((text: string) => {
    if (isLoadingContent.current) return;
    lastUserInputAtRef.current = Date.now();
  });

  const runFromToolbar = useCallback(() => {
    editorRef.current?.runCurrentQuery();
  }, []);

  const handleReorderTabs = useCallback((nextTabIds: UUIDv7[]) => {
    // AIDEV-NOTE: TabBar DnD commits ordering here; Tabbar reducer remains single source of truth.
    dispatch(reorderTabs({ tabIds: nextTabIds }));
  }, [dispatch]);

  const handleActivateTabForDrag = useCallback((tab: { dataQueryId: UUIDv7; tabId: UUIDv7; name: string }) => {
    const { tabId } = tab;
    if (tabId === (activeTabId || null)) return;
    // AIDEV-NOTE: For pointer-driven DnD, activate the tab without triggering a route change.
    dispatch(setActiveTabThunk(tabId));
  }, [dispatch, activeTabId]);

  const handleAddTab = useCallback(() => {
    if (isPendingTabTransition) return;

    const dataQueryId = generateUUIDv7();

    dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));

    startTabTransition(() => {
      router.replace(`/opspace/${opspaceId}/queries/${dataQueryId}`);
    });
  }, [dispatch, router, opspaceId, isPendingTabTransition, nextUntitledName]);

  const handleTabClose = useCallback(async (tabId: UUIDv7) => {
    if (isPendingTabTransition) return;

    try {
      const navigateToDataQueryId = await dispatch(closeTabThunk(tabId)).unwrap();

      startTabTransition(() => {
        if (navigateToDataQueryId) {
          router.replace(`/opspace/${opspaceId}/queries/${navigateToDataQueryId}`);
        } else {
          router.replace(`/opspace/${opspaceId}`);
        }
      });
    } catch (error) {
      console.error('handleTabClose: failed to close tab', { tabId, error });
    }
  }, [dispatch, router, opspaceId, isPendingTabTransition]);

  return (
    <div className={styles['query-workspace']} ref={containerRef}>
      {/* Tabs bar */}
      <TabBar
        tabs={tabsForBar}
        activeTabId={(activeTabId || '') as string}
        focusedTabIndex={focusedTabIndex ?? 0}
        onKeyDown={handleTablistKeyDown}
        onTabClick={handleTabClick}
        setTabRef={(idx, el) => { tabButtonRefs.current[idx] = el; }}
        onAddTab={handleAddTab}
        onCloseTab={handleTabClose}
        onReorderTabs={handleReorderTabs}
        onTabActivateForDrag={handleActivateTabForDrag}
      />

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
