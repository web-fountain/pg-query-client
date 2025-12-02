'use client';

import type { UUIDv7 }          from '@Types/primitives';

import {
  Fragment, memo, useCallback,
  useLayoutEffect, useMemo, useRef
}                               from 'react';
import Icon                     from '@Components/Icons';

import { useOpSpaceRoute }      from '../../../_providers/OpSpaceRouteProvider';
import { useTabDragAndDrop }    from './useTabDragAndDrop';
import styles                   from './styles.module.css';


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

// AIDEV-NOTE: Persist horizontal scroll position per opspace so that TabBar can
// restore the user's scroll offset across QueryWorkspace remounts (route changes
// between different dataQueryIds in the same opspace).
const lastScrollLeftByOpSpace = new Map<string, number>();

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
  const { opspaceId } = useOpSpaceRoute();
  const refsMap = useRef<Map<UUIDv7, HTMLButtonElement | null>>(new Map());
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const { canonicalIndexById, tabById } = useMemo(() => {
    const indexMap = new Map<UUIDv7, number>();
    const idMap = new Map<UUIDv7, Tab>();
    tabs.forEach((tab, idx) => {
      indexMap.set(tab.tabId, idx);
      idMap.set(tab.tabId, tab);
    });
    return { canonicalIndexById: indexMap, tabById: idMap };
  }, [tabs]);

  const getButtonEl = useCallback((tabId: UUIDv7) => {
    return refsMap.current.get(tabId) || null;
  }, []);

  const {
    draggingTabId,
    dropSeparatorIndex,
    beginDrag,
    updateDrag,
    endDrag
  } = useTabDragAndDrop({
    tabs,
    activeTabId,
    getButtonElAction: getButtonEl,
    onActivateTabAction: (tabId) => {
      const tab = tabs.find((t) => t.tabId === tabId);
      if (tab) {
        if (onTabActivateForDrag) {
          onTabActivateForDrag(tab);
        } else {
          onTabClick(tab);
        }
      }
    },
    onCommitOrderAction: onReorderTabs
  });

  // AIDEV-NOTE: Restore prior horizontal scroll position for this opspace's tab strip
  // so that route-driven remounts (navigating between queries) do not snap the bar
  // back to the left before scroll-into-view logic runs.
  useLayoutEffect(() => {
    const container = tablistRef.current;
    if (!container) return;

    const key = String(opspaceId || '');
    const last = lastScrollLeftByOpSpace.get(key);
    if (typeof last === 'number' && last > 0) {
      container.scrollLeft = last;
    }
  }, [opspaceId]);

  // AIDEV-NOTE: Keep the focused/active tab fully visible within the horizontal strip.
  // AIDEV-NOTE: useLayoutEffect ensures scroll adjustments happen before paint on mount,
  //             avoiding a flash at scrollLeft=0 followed by a jump to the active tab.
  useLayoutEffect(() => {
    if (!tabs || tabs.length === 0) return;

    // Prefer focused tab index when available; fall back to activeTabId.
    let targetButton: HTMLButtonElement | null = null;

    if (typeof focusedTabIndex === 'number') {
      const count = tabs.length;
      const clamped = (((focusedTabIndex || 0) % count) + count) % count;
      const focusedTab = tabs[clamped];
      if (focusedTab) {
        targetButton = refsMap.current.get(focusedTab.tabId) || null;
      }
    }

    if (!targetButton && activeTabId) {
      targetButton = refsMap.current.get(activeTabId as UUIDv7) || null;
    }

    const container = tablistRef.current;
    if (!targetButton || !container) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = targetButton.getBoundingClientRect();

    const intersectionWidth = Math.min(buttonRect.right, containerRect.right)
      - Math.max(buttonRect.left, containerRect.left);
    const tabWidth = buttonRect.width;

    // AIDEV-NOTE: Derive visibility semantics from the intersection between the tab
    // and the viewport:
    // - intersection <= 0        => fully off-screen
    // - intersection ~ tabWidth  => fully visible (within epsilon)
    // - 0 < intersection < width => partially visible
    const epsilon = 1;
    const isOffscreen = intersectionWidth <= 0;
    const isFullyVisible = !isOffscreen && intersectionWidth >= (tabWidth - epsilon);

    // AIDEV-NOTE: Only scroll when the tab is completely off-screen or only
    // partially visible. Tabs that are already fully visible are left as-is
    // to avoid unnecessary horizontal jumps when activating them.
    if (isFullyVisible) {
      return;
    }

    try {
      targetButton.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'nearest'
      });
    } catch {
      // AIDEV-NOTE: Fallback for older browsers without scrollIntoView options.
      targetButton.scrollIntoView();
    }

    // AIDEV-NOTE: Persist the new scroll offset so subsequent remounts within this
    // opspace start from the same visible region.
    try {
      const key = String(opspaceId || '');
      lastScrollLeftByOpSpace.set(key, container.scrollLeft);
    } catch {}
  }, [tabs.length, activeTabId, focusedTabIndex]);

  return (
    <div
      className={styles['tabs-bar']}
      data-dragging={draggingTabId ? 'true' : 'false'}
    >
      <span
        aria-hidden="true"
        className={`${styles['tab-separator']} ${
          draggingTabId && dropSeparatorIndex === 0 ? styles['tab-separator-drop-target'] : ''
        }`}
      />
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Query tabs"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          try {
            const key = String(opspaceId || '');
            lastScrollLeftByOpSpace.set(key, e.currentTarget.scrollLeft);
          } catch {}
        }}
      >
        {tabs.map((tab) => {
          const canonicalIndex = canonicalIndexById.get(tab.tabId) || 0;
          const selected = tab.tabId === activeTabId;
          const isFocusable = canonicalIndex === focusedTabIndex;
          const isDragging = draggingTabId === tab.tabId;
          const isLastTab = canonicalIndex === tabs.length - 1;
          const separatorIndex = canonicalIndex + 1;
          const isSeparatorDropTarget = draggingTabId
            && dropSeparatorIndex === separatorIndex;

          return (
            <Fragment key={tab.tabId}>
              <TabButton
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
              {!isLastTab && (
                <span
                  aria-hidden="true"
                  className={`${styles['tab-separator']} ${
                    isSeparatorDropTarget ? styles['tab-separator-drop-target'] : ''
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className={`${styles['tab-separator']} ${
          draggingTabId && dropSeparatorIndex === tabs.length ? styles['tab-separator-drop-target'] : ''
        }`}
      />
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
