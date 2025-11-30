'use client';

import type { UUIDv7 }  from '@Types/primitives';

import { memo }         from 'react';
import Icon             from '@Components/Icons';

import styles           from './styles.module.css';


type Tab = { dataQueryId: UUIDv7; tabId: UUIDv7; name: string };
type Props = {
  tabs            : Tab[];
  activeTabId     : string;
  focusedTabIndex : number;
  setTabRef       : (index: number, el: HTMLButtonElement | null) => void;
  onKeyDown       : (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onTabClick      : (tab: Tab) => void;
  onAddTab        : () => void;
  onCloseTab      : (tabId: UUIDv7) => void | Promise<void>;
};
type TabButtonProps = {
  tab         : Tab;
  selected    : boolean;
  isFocusable : boolean;
  index       : number;
  setRef      : (el: HTMLButtonElement | null) => void;
  onTabClick  : (tab: Tab) => void;
  onCloseTab  : (tabId: UUIDv7) => void | Promise<void>;
};

const TabButton = memo(function TabButton({ tab, selected, isFocusable, index, onTabClick, onCloseTab, setRef }: TabButtonProps) {
  return (
    <button
      id={`tab-${tab.tabId}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${tab.tabId}`}
      tabIndex={isFocusable ? 0 : -1}
      className={styles['tab']}
      ref={setRef}
      onClick={() => onTabClick(tab)}
      title={tab.name}
    >
      <Icon name="file" className={styles['icon']} />
      {tab.name}
      <span
        role="button"
        className={styles['tab-close']}
        aria-label="Close tab"
        title="Close"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onCloseTab(tab.tabId);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onCloseTab(tab.tabId);
          }
        }}
      >
        <Icon name="x" />
      </span>
    </button>
  );
});

function TabBar({ tabs, activeTabId, focusedTabIndex, onKeyDown, onTabClick, setTabRef, onAddTab, onCloseTab }: Props) {
  return (
    <div className={styles['tabs-bar']}>
      <span aria-hidden="true" className={styles['tab-separator']} />
      <div
        role="tablist"
        aria-label="Query tabs"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, idx) => {
          const selected = tab.tabId === activeTabId;
          const isFocusable = idx === focusedTabIndex;
          console.log(tab.tabId)
          return (
            <TabButton
              key={tab.tabId}
              tab={tab}
              selected={selected}
              isFocusable={isFocusable}
              index={idx}
              onTabClick={onTabClick}
              onCloseTab={onCloseTab}
              setRef={(el) => setTabRef(idx, el)}
            />
          );
        }).flatMap((el, i) => (i < tabs.length - 1 ? [el, (
          <span key={`sep-${i}`} aria-hidden="true" className={styles['tab-separator']} />
        )] : [el]))}
      </div>
      <span aria-hidden="true" className={styles['tab-separator']} />
      <button
        className={styles['tab-add']}
        aria-label="New tab"
        title="New tab"
        onClick={onAddTab}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}


export default TabBar;
