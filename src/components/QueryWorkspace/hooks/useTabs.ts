import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  STORAGE_KEY_TABS
} from '../constants';

export type TabItem = {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
};


// encapsulates tabs model, persistence, name drafts, and roving tabindex
function useTabs() {
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: DEFAULT_TAB_ID, name: DEFAULT_TAB_NAME, sql: '', createdAt: 0, updatedAt: 0 }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(0);
  const [storageLoaded, setStorageLoaded] = useState<boolean>(false);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // name draft for the active tab (unsaved)
  const [nameDraft, setNameDraft] = useState<string>(DEFAULT_TAB_NAME);

  // hydrate from storage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_TABS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.tabs) && typeof parsed?.activeTabId === 'string' && parsed.tabs.length > 0) {
          setTabs(parsed.tabs as TabItem[]);
          setActiveTabId(parsed.activeTabId as string);
        }
      }
    } catch {}
    setStorageLoaded(true);
  }, []);

  // persist (debounced)
  useEffect(() => {
    if (!storageLoaded) return;
    const timer = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({ tabs, activeTabId });
        window.localStorage.setItem(STORAGE_KEY_TABS, payload);
      } catch {}
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tabs, activeTabId, storageLoaded]);

  const activeIndex = useMemo(() => tabs.findIndex(t => t.id === activeTabId), [tabs, activeTabId]);

  useEffect(() => {
    if (activeIndex >= 0) setFocusedTabIndex(activeIndex);
    const active = tabs[activeIndex];
    setNameDraft(active?.name ?? DEFAULT_TAB_NAME);
  }, [activeIndex, tabs]);

  const focusTabByIndex = useCallback((index: number) => {
    const clamped = (index + tabs.length) % tabs.length;
    setFocusedTabIndex(clamped);
    const btn = tabButtonRefs.current[clamped];
    btn?.focus();
  }, [tabs.length]);

  const activateTabByIndex = useCallback((index: number) => {
    const clamped = (index + tabs.length) % tabs.length;
    setActiveTabId(tabs[clamped]?.id || activeTabId);
  }, [tabs, activeTabId]);

  const addTab = useCallback(() => {
    // AIDEV-NOTE: Generate a unique, monotonic tab id even after deletions
    const maxN = tabs.reduce((max, t) => {
      const m = /^tab-(\d+)$/.exec(t.id);
      const n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    const id = `tab-${maxN + 1}`;
    const untitledBase = 'Untitled';
    const existingUntitledCount = tabs.filter(t => t.name.startsWith(untitledBase)).length;
    const newName = existingUntitledCount > 0 ? `${untitledBase} ${existingUntitledCount + 1}` : `${untitledBase}`;
    const newTab: TabItem = { id, name: newName, sql: '', createdAt: 0, updatedAt: 0 };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
    setFocusedTabIndex(tabs.length);
    requestAnimationFrame(() => {
      const btn = tabButtonRefs.current[tabs.length];
      btn?.focus();
    });
  }, [tabs]);

  return {
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
    addTab,
    nameDraft,
    setNameDraft
  } as const;
}


export { useTabs };
