'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import Icon   from '@Components/Icons';
import styles from './styles.module.css';

// AIDEV-NOTE: Accessible tabs with no-remount panels. Both panels stay mounted; visibility toggles via hidden/aria-hidden.

export type TabItem = {
  id: string;
  label: string;
  icon?: string;
  panel: React.ReactNode;
};

type TabsProps = {
  tabs: TabItem[];
  defaultTabId?: string;
};

function Tabs({ tabs, defaultTabId }: TabsProps) {
  // AIDEV-NOTE: Manage active tab id; default to provided or first tab id.
  const firstId = tabs[0]?.id;
  const baseId = useId();
  const [activeId, setActiveId] = useState<string>(defaultTabId || firstId);

  // AIDEV-NOTE: Keep first computed panel elements stable to avoid remounts.
  const initialPanelsRef = useRef<Record<string, React.ReactNode>>({});
  if (Object.keys(initialPanelsRef.current).length === 0) {
    for (const t of tabs) initialPanelsRef.current[t.id] = t.panel;
  }

  // AIDEV-NOTE: Cache button refs for focus management (arrow keys).
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  useEffect(() => {
    // Guard activeId if tabs change dynamically
    if (!tabIds.includes(activeId)) setActiveId(tabIds[0]);
  }, [tabIds, activeId]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabIds.indexOf(activeId);
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabIds.length - 1;
    else return;
    e.preventDefault();
    const nextId = tabIds[nextIndex];
    buttonRefs.current[nextId]?.focus();
  }, [activeId, tabIds]);

  const onClickTab = useCallback((id: string) => setActiveId(id), []);

  return (
    <div className={styles['tabs']}>
      <div
        role="tablist"
        aria-label="Directory panel tabs"
        className={styles['tablist']}
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const selected = t.id === activeId;
          const tabId = `${baseId}-tab-${t.id}`;
          const panelId = `${baseId}-panel-${t.id}`;
          return (
            <button
              key={t.id}
              ref={(el) => { buttonRefs.current[t.id] = el; }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className={styles['tab']}
              onClick={() => onClickTab(t.id)}
            >
              {t.icon ? (
                <span className={styles['tab-icon']} aria-hidden="true"><Icon name={t.icon} /></span>
              ) : null}
              <span className={styles['tab-label']}>{t.label}</span>
              <span className={styles['tab-underline']} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className={styles['panels']}>
        {tabs.map((t) => {
          const selected = t.id === activeId;
          const tabId = `${baseId}-tab-${t.id}`;
          const panelId = `${baseId}-panel-${t.id}`;
          return (
            <div
              key={t.id}
              role="tabpanel"
              id={panelId}
              aria-labelledby={tabId}
              className={styles['panel']}
              hidden={!selected}
              aria-hidden={!selected}
            >
              {initialPanelsRef.current[t.id]}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export default Tabs;
