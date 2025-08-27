'use client';

import { memo } from 'react';
import Icon     from '@Components/Icons';
import styles   from './styles.module.css';


type Tab = { id: string; name: string };
type Props = {
  tabs            : Tab[];
  activeTabId     : string;
  focusedTabIndex : number;
  setTabRef       : (index: number, el: HTMLButtonElement | null) => void;
  onKeyDown       : (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onTabClick      : (index: number, id: string) => void;
  onAddTab        : () => void;
  onCloseTab      : (index: number, id: string) => void;
};
type TabButtonProps = {
  id          : string;
  name        : string;
  selected    : boolean;
  isFocusable : boolean;
  index       : number;
  setRef      : (el: HTMLButtonElement | null) => void;
  onTabClick  : (index: number, id: string) => void;
  onCloseTab  : (index: number, id: string) => void;
};

const TabButton = memo(function TabButton({ id, name, selected, isFocusable, index, onTabClick, onCloseTab, setRef }: TabButtonProps) {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      tabIndex={isFocusable ? 0 : -1}
      className={styles['tab']}
      ref={setRef}
      onClick={() => onTabClick(index, id)}
      title={name}
    >
      <Icon name="file" className={styles['icon']} />
      {name}
      <span
        role="button"
        className={styles['tab-close']}
        aria-label="Close tab"
        title="Close"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onCloseTab(index, id); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onCloseTab(index, id);
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
      <div
        role="tablist"
        aria-label="Query tabs"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t, idx) => {
          const selected = t.id === activeTabId;
          const isFocusable = idx === focusedTabIndex;
          return (
            <TabButton
              key={t.id}
              id={t.id}
              name={t.name}
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
