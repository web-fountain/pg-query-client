'use client';

import type { QueryWorkspaceProps } from '@Types/workspace';
import type { SQLEditorHandle }     from '../../_components/SQLEditor';

import {
  useCallback, useEffect, useMemo,
  useRef, useState
}                                   from 'react';
import { useRouter }                from 'next/navigation';

import {
  useReduxDispatch,
  useReduxSelector
}                                   from '@Redux/storeHooks';
import { rehydrateRoute }           from '@Redux/records/route';
import {
  rehydrateFromServer,
  mergeFromLocal,
  addTab            as addTabAction,
  closeTab          as closeTabAction,
  activateTab       as activateTabAction,
  focusTabIndex     as focusTabIndexAction,
  setNameDraft      as setNameDraftAction,
  setSqlDraft       as setSqlDraftAction,
  commitSaveActive  as commitSaveActiveAction,
  selectTabs,
  selectDrafts,
  selectActiveTabId,
  selectMergedFromLocal,
  selectFocusedTabIndex,
  selectHydratedFromServer
}                                   from '@Redux/records/tabs';
import { useDebouncedCallback }     from '@Hooks/useDebounce';

import { useSqlRunner }             from '../../../_providers/SQLRunnerProvider';
import {
  createNewQuery, openQuery,
  activateQuery, closeQuery,
  saveQueryContent
}                                   from '../../_actions/queries';
import SQLEditor                    from '../SQLEditor';
import QueryResults                 from '../QueryResults';
import TabBar                       from './TabBar';
import Toolbar                      from './Toolbar';
import SplitPane                    from './SplitPane';

import { STORAGE_KEY_SPLIT }        from './constants';
import { useEvent }                 from './hooks/useEvent';

import styles                       from './styles.module.css';


// AIDEV-NOTE: SQLEditor is large; if initial TTI needs improvement, consider next/dynamic.
function QueryWorkspace({ clientId, initialTabs, initialActiveId }: QueryWorkspaceProps) {
  const { isRunning, setSqlText, sqlText }  = useSqlRunner();

  const router                              = useRouter();
  const editorRef                           = useRef<SQLEditorHandle | null>(null);
  const containerRef                        = useRef<HTMLDivElement  | null>(null);
  const topPanelRef                         = useRef<HTMLDivElement  | null>(null);
  const bottomPanelRef                      = useRef<HTMLDivElement  | null>(null);
  const tabButtonRefs                       = useRef<Array<HTMLButtonElement | null>>([]);

  // AIDEV-NOTE: Split ratio is local; we persist only on commit.
  const [topRatio, setTopRatio] = useState<number>(0.5);

  // AIDEV-NOTE: Tabs via Redux records (drafts in store)
  const tabs                              = useReduxSelector(selectTabs);
  const activeTabId                       = useReduxSelector(selectActiveTabId);
  const focusedTabIndex                   = useReduxSelector(selectFocusedTabIndex);
  const drafts                            = useReduxSelector(selectDrafts);
  const hydratedFromServer                = useReduxSelector(selectHydratedFromServer);
  const mergedFromLocal                   = useReduxSelector(selectMergedFromLocal);
  const dispatch                          = useReduxDispatch();

  const draftsRef                         = useRef(drafts);
  const nameDraft                         = (activeTabId && drafts[activeTabId]?.nameDraft) ?? (tabs.find((t: { id: string; name: string }) => t.id === activeTabId)?.name ?? 'Untitled');

  // AIDEV-NOTE: Cache last known non-empty editor value per tab to defend against transient clears.
  const lastEditorValueByTabRef = useRef<Record<string, string>>({});

  // AIDEV-NOTE: Precompute saveDisabled and editor onChange to keep hooks order stable
  const saveDisabled = useMemo(() => {
    const active = (tabs as Array<{ id: string; name?: string; sql?: string }>).find((t) => t.id === activeTabId);
    const savedName = active?.name ?? '';
    const savedSql  = active?.sql ?? '';
    const draftSql  = activeTabId ? (drafts[activeTabId]?.sqlDraft ?? savedSql) : savedSql;

    return (nameDraft === savedName) && (draftSql === savedSql);
  }, [tabs, activeTabId, nameDraft, drafts]);

  // AIDEV-NOTE: Track if we're loading content to prevent saving drafts during tab switches
  const isLoadingContent = useRef(false);

  // AIDEV-NOTE: Debounced draft saver that captures tab id as an argument to avoid
  // late-binding to a changed activeTabId when the timeout fires after navigation.
  const debouncedSaveDraft = useDebouncedCallback((id: string, text: string) => {
    dispatch(setSqlDraftAction({ id, sql: text }));
  }, 150);

  const editorOnChange = useEvent((text: string) => {
    if (!activeTabId) return;
    if (isLoadingContent.current) return;
    debouncedSaveDraft(activeTabId, text);
  });

  const runFromToolbar = useCallback(() => {
    editorRef.current?.runCurrentQuery();
  }, []);

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

  // AIDEV-NOTE: Cache drafts
  useEffect(() => { draftsRef.current = drafts; }, [drafts]);

  // AIDEV-NOTE: Keyboard shortcuts for run/save.
  useEffect(() => {
    // Rehydrate route and server tabs into Redux on first mount
    dispatch(rehydrateRoute({ clientId, queryId: initialActiveId }));
    if (Array.isArray(initialTabs) && initialTabs.length > 0 && initialActiveId) {
      dispatch(rehydrateFromServer({ tabs: initialTabs, activeTabId: initialActiveId }));
    }
    // Client-only merge from localStorage (names/active tab)
    try {
      const raw = window.localStorage.getItem('pg-query-client/query-workspace/tabs' + `/${clientId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch(mergeFromLocal({ tabs: Array.isArray(parsed?.tabs) ? parsed.tabs : undefined, activeTabId: parsed?.activeTabId }));
      }
    } catch {}
  }, [dispatch, clientId, initialActiveId, initialTabs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === 'enter') {
        e.preventDefault();
        editorRef.current?.runCurrentQuery();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        // AIDEV-NOTE: Save stub for now — will integrate with persistence later.
        // eslint-disable-next-line no-console
        const active = (tabs as Array<{ id: string; name?: string }>).find((t) => t.id === activeTabId);
        console.log('AIDEV-NOTE: saveQuery is not implemented yet. name=', active?.name);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs as Array<{ id: string; name?: string }>, activeTabId]);

  // AIDEV-NOTE: Helpers for tabs behavior and editor sync.
  const getCurrentEditorText = useCallback(() => {
    return editorRef.current?.getCurrentText() || '';
  }, []);

  // AIDEV-NOTE: Snapshot current editor text into draft store (not committing to saved tabs)
  const snapshotCurrentEditorDraft = useCallback(() => {
    const text = getCurrentEditorText();
    if (activeTabId) dispatch(setSqlDraftAction({ id: activeTabId, sql: text }));
  }, [activeTabId, getCurrentEditorText, dispatch]);

  useEffect(() => {
    // AIDEV-NOTE: When active tab changes, load draft-or-saved SQL into provider for editor hydration
    const idx = Math.max(0, tabs.findIndex((t: { id: string }) => t.id === activeTabId));
    const active = tabs[idx];
    // Only perform hydration after server and local rehydrations have occurred to avoid
    // immediately overwriting drafts with stale state during the initial mount sequence.
    if (active && activeTabId && hydratedFromServer && mergedFromLocal) {
      const d = draftsRef.current;
      const draftSql = d?.[activeTabId]?.sqlDraft;
      // Set flag to prevent onChange from saving this as a draft
      isLoadingContent.current = true;
      setSqlText(draftSql != null ? draftSql : active.sql || '');
      // Clear flag after a delay longer than the debounce
      setTimeout(() => { isLoadingContent.current = false; }, 200);
    }
  }, [activeTabId, tabs, setSqlText, hydratedFromServer, mergedFromLocal]);

  // AIDEV-NOTE: Guard against provider reset after navigation/remount.
  // If provider sqlText becomes empty but we have a draft/saved value, restore it.
  useEffect(() => {
    if (!activeTabId) return;
    const current = sqlText || '';
    if (current) return;
    const d = draftsRef.current;
    const draftSql = d?.[activeTabId]?.sqlDraft;
    const savedSql = (tabs.find((t: { id: string }) => t.id === activeTabId)?.sql || '');
    const next = draftSql != null ? draftSql : savedSql;
    if (next) {
      isLoadingContent.current = true;
      setSqlText(next);
      setTimeout(() => { isLoadingContent.current = false; }, 200);
    }
  }, [sqlText, activeTabId, tabs, setSqlText]);

  const handleAddTab = useCallback(async () => {
    snapshotCurrentEditorDraft();
    const id: string = crypto.randomUUID();
    const now = Date.now();
    dispatch(addTabAction({ id, name: 'Untitled', createdAt: now, updatedAt: now }));
    setSqlText('');
    router.replace(`/clients/${clientId}/queries/${id}`);
    // Fire-and-forget server calls
    Promise.resolve().then(async () => {
      try {
        await createNewQuery({ clientId, name: 'Untitled', initialSql: '', queryId: id });
        await openQuery({ clientId, queryId: id, name: 'Untitled' });
        await activateQuery({ clientId, queryId: id });
      } catch {}
    });
  }, [snapshotCurrentEditorDraft, dispatch, setSqlText, router, clientId]);

  const renameActiveTab = useCallback((nextName: string) => {
    if (activeTabId) dispatch(setNameDraftAction({ id: activeTabId, name: nextName }));
  }, [dispatch, activeTabId]);

  // AIDEV-NOTE: Do not push nameDraft to saved tabs until explicit Save is clicked
  const handleTabClick = useCallback((index: number, id: string) => {
    // Manual activation: clicking activates; save current tab first.
    snapshotCurrentEditorDraft();
    // Cancel any pending debounced draft write from the previous tab to avoid
    // cross-tab overwrites firing after navigation.
    try { (debouncedSaveDraft as any).cancel?.(); } catch {}
    dispatch(activateTabAction({ id }));
    dispatch(focusTabIndexAction({ index }));
    // Defer navigation by one frame to allow Redux state to render before route remount
    requestAnimationFrame(() => {
      router.replace(`/clients/${clientId}/queries/${id}`);
      // Fire-and-forget server update; do not block UI or navigation
      Promise.resolve().then(() => activateQuery({ clientId, queryId: id }).catch(() => {}));
    });
  }, [snapshotCurrentEditorDraft, clientId, router, dispatch, debouncedSaveDraft]);

  const handleTablistKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length === 0) return;
    const key = e.key;
    if (key === 'ArrowRight') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: focusedTabIndex + 1 }));
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: focusedTabIndex - 1 }));
    } else if (key === 'Home') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: 0 }));
    } else if (key === 'End') {
      e.preventDefault();
      dispatch(focusTabIndexAction({ index: tabs.length - 1 }));
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      // Activate the focused tab; snapshot current editor draft first.
      snapshotCurrentEditorDraft();
      try { (debouncedSaveDraft as any).cancel?.(); } catch {}
      const nextId = tabs[(focusedTabIndex + tabs.length) % tabs.length]?.id as string | undefined;
      if (nextId) {
        dispatch(activateTabAction({ id: nextId }));
        router.replace(`/clients/${clientId}/queries/${nextId}`);
        Promise.resolve().then(() => activateQuery({ clientId, queryId: nextId }).catch(() => {}));
      }
    }
  }, [tabs.length, focusedTabIndex, dispatch, snapshotCurrentEditorDraft, clientId, router, debouncedSaveDraft]);

  // AIDEV-NOTE: Removed legacy, unused local drag logic; `SplitPane` manages resizing.

  const topStyle = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);

  const activeIndex = Math.max(0, (tabs as Array<{ id: string }>).findIndex((t) => t.id === (activeTabId || '')));
  const activeTab = tabs[activeIndex] || tabs[0];

  return (
    <div className={styles['query-workspace']} ref={containerRef}>
      {/* Tabs bar */}
      <TabBar
        tabs={tabs as Array<{ id: string; name: string }>}
        activeTabId={(activeTabId || '') as string}
        focusedTabIndex={focusedTabIndex}
        onKeyDown={handleTablistKeyDown}
        onTabClick={handleTabClick}
        setTabRef={(idx, el) => { tabButtonRefs.current[idx] = el; }}
        onAddTab={handleAddTab}
        onCloseTab={async (index: number, id: string) => {
          // AIDEV-NOTE: Remove tab; adjust active/focus; preserve drafts
          const next = (tabs as Array<{ id: string }>).filter((t) => t.id !== id);
          if (next.length === 0) return; // keep at least one tab (no-op)

          let navigateToId: string | null = null;
          if (activeTabId === id) {
            const fallbackIndex = Math.max(0, index - 1);
            navigateToId = next[Math.min(fallbackIndex, next.length - 1)].id;
          }

          dispatch(closeTabAction({ id }));
          if (navigateToId) {
            dispatch(activateTabAction({ id: navigateToId }));
            dispatch(focusTabIndexAction({ index: Math.min(index - 1, next.length - 1) }));
            try { await closeQuery({ clientId, queryId: id }); } catch {}
            router.replace(`/clients/${clientId}/queries/${navigateToId}`);
          } else if (focusedTabIndex >= next.length) {
            dispatch(focusTabIndexAction({ index: next.length - 1 }));
          }

          if (!navigateToId) {
            try { await closeQuery({ clientId, queryId: id }); } catch {}
          }
        }}
      />

      {/* Active tabpanel wrapping toolbar and content */}
      <div
        id={activeTab ? `panel-${activeTab.id}` : 'panel-empty'}
        role="tabpanel"
        aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
        className={styles['tabpanel']}
        style={{ display: activeTab ? 'contents' : 'none' }}
      >
        {/* Toolbar within the active tab panel */}
        <Toolbar
          name={nameDraft}
          onNameChange={renameActiveTab}
          isRunning={isRunning}
          onRun={runFromToolbar}
          onSave={async () => {
            const latestText = getCurrentEditorText();
            if (activeTabId) {
              // push latest draft to store then commit
              dispatch(setSqlDraftAction({ id: activeTabId, sql: latestText }));
              dispatch(commitSaveActiveAction());
              try {
                await saveQueryContent({ clientId, queryId: activeTabId, name: nameDraft, sql: latestText });
              } catch {}
            }
          }}
          saveDisabled={saveDisabled}
        />

        <SplitPane
          top={(
            <SQLEditor
              editorRef={editorRef}
              onChange={editorOnChange}
              value={(function computeValue() {
                const id = (activeTabId || '') as string;
                const saved = ((tabs.find((t: { id: string }) => t.id === id)?.sql) || '') as string;
                const draft = (id && drafts[id]?.sqlDraft != null ? (drafts[id]?.sqlDraft as string) : undefined);
                let next = (draft != null ? draft : saved) as string;
                if (!next && id) {
                  const cached = lastEditorValueByTabRef.current[id];
                  if (cached) next = cached;
                }
                if (id && next) lastEditorValueByTabRef.current[id] = next;
                return next;
              })() as string}
            />
          )}
          bottom={<QueryResults />}
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
