'use client';

import type { SQLEditorHandle } from '@Components/SQLEditor';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// AIDEV-NOTE: SQLEditor is large; if initial TTI needs improvement, consider next/dynamic.
import SQLEditor from '@Components/SQLEditor';
import QueryResults from '@Components/QueryResults';
import TabBar from './TabBar';
import Toolbar from './Toolbar';
import SplitPane from './SplitPane';
import { useSqlRunner } from '@Components/providers/SQLRunnerProvider';

import { STORAGE_KEY_SPLIT } from './constants';
import { useSplitRatio } from './hooks/useSplitRatio';
import { useEvent } from './hooks/useEvent';
import { useTabs } from './hooks/useTabs';
import { useDebouncedCallback } from '@Hooks/useDebounce';

import styles from './styles.module.css';

// AIDEV-NOTE: Resizer is fully handled by `ResizableHandle/VerticalHandle` inside `SplitPane`.

function QueryWorkspace() {
  // AIDEV-NOTE: Editor handle for external run trigger from toolbar and shortcuts.
  const editorRef = useRef<SQLEditorHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const { isRunning, setSqlText } = useSqlRunner();

  // AIDEV-NOTE: Split ratio via hook (includes persistence and clamping)
  const { ratio: topRatio, setRatio: setTopRatio } = useSplitRatio();

  // AIDEV-NOTE: Tabs state via hook (persistence, name draft, roving tabindex)
  const {
    tabs,
    setTabs,
    tabButtonRefs,
    activeTabId,
    setActiveTabId,
    focusedTabIndex,
    setFocusedTabIndex,
    activeIndex,
    focusTabByIndex,
    activateTabByIndex,
    addTab: addTabHook,
    nameDraft,
    setNameDraft
  } = useTabs();
  const [sqlDraftByTab, setSqlDraftByTab] = useState<Record<string, string>>({});

  const runFromToolbar = useCallback(() => {
    editorRef.current?.runCurrentQuery();
  }, []);

  // AIDEV-NOTE: Keyboard shortcuts for run/save.
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
        const active = tabs.find(t => t.id === activeTabId);
        console.log('AIDEV-NOTE: saveQuery is not implemented yet. name=', active?.name);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId]);

  // AIDEV-NOTE: Helpers for tabs behavior and editor sync.
  const getCurrentEditorText = useCallback(() => {
    return editorRef.current?.getCurrentText() || '';
  }, []);

  // AIDEV-NOTE: Snapshot current editor text into draft store (not committing to saved tabs)
  const snapshotCurrentEditorDraft = useCallback(() => {
    const text = getCurrentEditorText();
    setSqlDraftByTab(prev => ({ ...prev, [activeTabId]: text }));
  }, [activeTabId, getCurrentEditorText]);

  useEffect(() => {
    // AIDEV-NOTE: When active tab changes, load draft-or-saved SQL into provider for editor hydration
    const active = tabs[activeIndex];
    if (active) {
      const draft = sqlDraftByTab[active.id];
      setSqlText(draft != null ? draft : active.sql || '');
    }
  }, [activeIndex, tabs, sqlDraftByTab, setSqlText]);

  const handleAddTab = useCallback(() => {
    snapshotCurrentEditorDraft();
    addTabHook();
    setSqlText('');
  }, [snapshotCurrentEditorDraft, addTabHook, setSqlText]);

  const renameActiveTab = useCallback((nextName: string) => {
    setNameDraft(nextName);
  }, [setNameDraft]);

  // AIDEV-NOTE: Do not push nameDraft to saved tabs until explicit Save is clicked
  const handleTabClick = useCallback((index: number, id: string) => {
    // Manual activation: clicking activates; save current tab first.
    snapshotCurrentEditorDraft();
    setActiveTabId(id);
    setFocusedTabIndex(index);
  }, [snapshotCurrentEditorDraft]);

  const handleTablistKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (tabs.length === 0) return;
    const key = e.key;
    if (key === 'ArrowRight') {
      e.preventDefault();
      focusTabByIndex(focusedTabIndex + 1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      focusTabByIndex(focusedTabIndex - 1);
    } else if (key === 'Home') {
      e.preventDefault();
      focusTabByIndex(0);
    } else if (key === 'End') {
      e.preventDefault();
      focusTabByIndex(tabs.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      // Activate the focused tab; snapshot current editor draft first.
      snapshotCurrentEditorDraft();
      activateTabByIndex(focusedTabIndex);
    }
  }, [tabs.length, focusedTabIndex, focusTabByIndex, snapshotCurrentEditorDraft, activateTabByIndex]);

  // AIDEV-NOTE: Removed legacy, unused local drag logic; `SplitPane` manages resizing.

  const topStyle = useMemo(() => ({ height: `${Math.round(topRatio * 100)}%` }), [topRatio]);
  const bottomStyle = useMemo(() => ({ height: `${Math.round((1 - topRatio) * 100)}%` }), [topRatio]);

  const activeTab = tabs[activeIndex] || tabs[0];

  return (
    <div className={styles['query-workspace']} ref={containerRef}>
      {/* Tabs bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        focusedTabIndex={focusedTabIndex}
        onKeyDown={handleTablistKeyDown}
        onTabClick={handleTabClick}
        setTabRef={(idx, el) => { tabButtonRefs.current[idx] = el; }}
        onAddTab={handleAddTab}
        onCloseTab={(index, id) => {
          // AIDEV-NOTE: Remove tab; adjust active/focus; preserve drafts
          setTabs(prev => {
            const next = prev.filter(t => t.id !== id);
            if (next.length === 0) return prev; // keep at least one tab (no-op)
            // fix active
            if (activeTabId === id) {
              const fallbackIndex = Math.max(0, index - 1);
              setActiveTabId(next[Math.min(fallbackIndex, next.length - 1)].id);
            }
            // fix focus
            if (focusedTabIndex >= next.length) {
              setFocusedTabIndex(next.length - 1);
            }
            return next;
          });
        }}
      />

      {/* Active tabpanel wrapping toolbar and content */}
      {activeTab && (
        <div
          id={`panel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          className={styles['tabpanel']}
        >
          {/* Toolbar within the active tab panel */}
          <Toolbar
            name={nameDraft}
            onNameChange={renameActiveTab}
            isRunning={isRunning}
            onRun={runFromToolbar}
            onSave={() => {
              const latestText = getCurrentEditorText();
              setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: nameDraft, sql: latestText } : t));
              setSqlDraftByTab(prev => ({ ...prev, [activeTabId]: latestText }));
            }}
            saveDisabled={useMemo(() => {
              const active = tabs.find(t => t.id === activeTabId);
              const savedName = active?.name ?? '';
              const savedSql = active?.sql ?? '';
              const draftSql = sqlDraftByTab[activeTabId] ?? savedSql;
              return (nameDraft === savedName) && (draftSql === savedSql);
            }, [tabs, activeTabId, nameDraft, sqlDraftByTab])}
          />

          <SplitPane
            top={(
              <SQLEditor
                editorRef={editorRef}
                onChange={useEvent(
                  useDebouncedCallback((text: string) => {
                    setSqlDraftByTab(prev => ({ ...prev, [activeTabId]: text }));
                  }, 150)
                )}
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
      )}
    </div>
  );
}


export default QueryWorkspace;
