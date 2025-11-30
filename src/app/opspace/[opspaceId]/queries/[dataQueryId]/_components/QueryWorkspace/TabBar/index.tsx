'use client';

import type { UUIDv7 }        from '@Types/primitives';

import {
  memo, useCallback,
  useMemo, useRef
}                             from 'react';
import Icon                   from '@Components/Icons';

import { useTabDragAndDrop }  from './useTabDragAndDrop';
import styles                 from './styles.module.css';


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
  onReorderTabs   : (tabIds: UUIDv7[]) => void;
  onTabActivateForDrag?: (tab: Tab) => void;
};
type TabButtonProps = {
  tab         : Tab;
  selected    : boolean;
  isFocusable : boolean;
  setRef      : (el: HTMLButtonElement | null) => void;
  onTabClick  : (tab: Tab) => void;
  onCloseTab  : (tabId: UUIDv7) => void | Promise<void>;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp  : (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => void;
  isDragging  : boolean;
};

const TabButton = memo(function TabButton({
  tab,
  selected,
  isFocusable,
  onTabClick,
  onCloseTab,
  setRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  isDragging
}: TabButtonProps) {
  return (
    <button
      id={`tab-${tab.tabId}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${tab.tabId}`}
      tabIndex={isFocusable ? 0 : -1}
      className={`${styles['tab']} ${isDragging ? styles['tab-dragging'] : ''}`}
      ref={setRef}
      onClick={() => onTabClick(tab)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
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
        data-tab-close="true"
      >
        <Icon name="x" />
      </span>
    </button>
  );
});

function TabBar({
  tabs,
  activeTabId,
  focusedTabIndex,
  onKeyDown,
  onTabClick,
  setTabRef,
  onAddTab,
  onCloseTab,
  onReorderTabs,
  onTabActivateForDrag
}: Props) {
  const refsMap = useRef<Map<UUIDv7, HTMLButtonElement | null>>(new Map());

  const canonicalIndexById = useMemo(() => {
    const map = new Map<UUIDv7, number>();
    tabs.forEach((tab, idx) => {
      map.set(tab.tabId, idx);
    });
    return map;
  }, [tabs]);

  const getButtonEl = useCallback((tabId: UUIDv7) => {
    return refsMap.current.get(tabId) || null;
  }, []);

  const {
    draggingTabId,
    renderOrder,
    beginDrag,
    updateDrag,
    endDrag
  } = useTabDragAndDrop({
    tabs,
    activeTabId,
    getButtonEl,
    onActivateTab: (tabId) => {
      const tab = tabs.find((t) => t.tabId === tabId);
      if (tab) {
        if (onTabActivateForDrag) {
          onTabActivateForDrag(tab);
        } else {
          onTabClick(tab);
        }
      }
    },
    onCommitOrder: onReorderTabs
  });

  const orderedTabs = renderOrder
    ? renderOrder.map((id) => tabs.find((t) => t.tabId === id) as Tab).filter(Boolean)
    : tabs;

  return (
    <div
      className={styles['tabs-bar']}
      data-dragging={draggingTabId ? 'true' : 'false'}
    >
      <span aria-hidden="true" className={styles['tab-separator']} />
      <div
        role="tablist"
        aria-label="Query tabs"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
      >
        {orderedTabs.map((tab, visualIndex) => {
          const canonicalIndex = canonicalIndexById.get(tab.tabId) || 0;
          const selected = tab.tabId === activeTabId;
          const isFocusable = canonicalIndex === focusedTabIndex;
          const isDragging = draggingTabId === tab.tabId;

          return (
            <TabButton
              key={tab.tabId}
              tab={tab}
              selected={selected}
              isFocusable={isFocusable}
              onTabClick={onTabClick}
              onCloseTab={onCloseTab}
              setRef={(el) => {
                refsMap.current.set(tab.tabId, el);
                setTabRef(canonicalIndex, el);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                const target = e.target as HTMLElement;
                if (target.closest('[data-tab-close="true"]')) return;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
                beginDrag(tab.tabId, e.clientX);
              }}
              onPointerMove={(e) => {
                if (!(e.buttons & 1)) return;
                updateDrag(e.clientX);
              }}
              onPointerUp={(e) => {
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
                endDrag();
              }}
              onPointerCancel={() => {
                endDrag();
              }}
              isDragging={isDragging}
            />
          );
        }).flatMap((el, i) => (i < orderedTabs.length - 1 ? [el, (
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
