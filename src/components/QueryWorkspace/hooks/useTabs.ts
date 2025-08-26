import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TAB_ID, DEFAULT_TAB_NAME, STORAGE_KEY_TABS } from '../constants';
import { createNewQuery, openQuery, closeQuery, activateQuery } from '@/app/_actions/queries';

export type TabItem = {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
};


// encapsulates tabs model, persistence, name drafts, and roving tabindex
function useTabs(opts: { clientId: string; initialTabs: TabItem[]; initialActiveId: string }) {
  const { clientId, initialTabs, initialActiveId } = opts;
  // AIDEV-NOTE: Initialize from server-provided state; fall back to defaults if empty
  const [tabs, setTabs] = useState<TabItem[]>(
    Array.isArray(initialTabs) && initialTabs.length > 0
      ? initialTabs
      : [{ id: DEFAULT_TAB_ID, name: DEFAULT_TAB_NAME, sql: '', createdAt: 0, updatedAt: 0 }]
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    (initialActiveId && (initialTabs || []).some(t => t.id === initialActiveId))
      ? initialActiveId
      : (initialTabs?.[0]?.id || DEFAULT_TAB_ID)
  );
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(0);
  const [storageLoaded, setStorageLoaded] = useState<boolean>(false);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // name draft for the active tab (unsaved)
  const [nameDraft, setNameDraft] = useState<string>(DEFAULT_TAB_NAME);

  // hydrate from storage (client-scoped): prefer route-provided active tab; merge stored names for consistency
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY_TABS}/${clientId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const storedActive: string | undefined = typeof parsed?.activeTabId === 'string' ? parsed.activeTabId : undefined;
        const routeActive = initialActiveId;
        const routeActiveExists = tabs.some(t => t.id === routeActive);
        const storedActiveExists = storedActive ? tabs.some(t => t.id === storedActive) : false;
        const nextActive = routeActiveExists ? routeActive : (storedActiveExists ? storedActive : activeTabId);
        if (nextActive && nextActive !== activeTabId) setActiveTabId(nextActive);

        if (Array.isArray(parsed?.tabs)) {
          const storedTabs = parsed.tabs as TabItem[];
          const merged = tabs.map(t => {
            const st = storedTabs.find(s => s.id === t.id);
            return st ? { ...t, name: st.name || t.name } : t;
          });
          // shallow compare names to avoid unnecessary re-renders
          const changed = merged.some((m, i) => m.name !== tabs[i]?.name);
          if (changed) setTabs(merged);
        }
      }
    } catch {}
    setStorageLoaded(true);
  }, [clientId, initialActiveId, tabs, activeTabId]);

  // persist (debounced)
  useEffect(() => {
    if (!storageLoaded) return;
    const timer = window.setTimeout(() => {
      try {
        const payload = JSON.stringify({ tabs, activeTabId });
        window.localStorage.setItem(`${STORAGE_KEY_TABS}/${clientId}`, payload);
      } catch {}
    }, 300);
    return () => window.clearTimeout(timer);
  }, [clientId, tabs, activeTabId, storageLoaded]);

  const activeIndex = useMemo(() => tabs.findIndex(t => t.id === activeTabId), [tabs, activeTabId]);

  useEffect(() => {
    if (activeIndex >= 0) {
      setFocusedTabIndex(activeIndex);
      // AIDEV-NOTE: After route changes/remounts, ensure DOM focus moves to the active tab button
      requestAnimationFrame(() => {
        const btn = tabButtonRefs.current[activeIndex];
        btn?.focus();
      });
    }
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

  const addTab = useCallback(async (): Promise<string> => {
    // AIDEV-NOTE: Compute ID and update UI immediately for responsiveness
    const newName = 'Untitled';
    const now = Date.now();
    const id = crypto.randomUUID();

    const newTab: TabItem = { id, name: newName, sql: '', createdAt: now, updatedAt: now };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
    setFocusedTabIndex(tabs.length);
    try {
      // Immediate persist so hydration can merge correct name post-route
      const payload = JSON.stringify({ tabs: [...tabs, newTab], activeTabId: id });
      window.localStorage.setItem(`${STORAGE_KEY_TABS}/${clientId}`, payload);
    } catch {}
    requestAnimationFrame(() => {
      const btn = tabButtonRefs.current[tabs.length];
      btn?.focus();
    });
    // AIDEV-NOTE: Fire-and-forget server calls; do not block UI
    Promise.resolve().then(async () => {
      try {
        await createNewQuery({ clientId, name: newName, initialSql: '', queryId: id });
        await openQuery({ clientId, queryId: id, name: newName });
        await activateQuery({ clientId, queryId: id });
      } catch {}
    });
    return id;
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
