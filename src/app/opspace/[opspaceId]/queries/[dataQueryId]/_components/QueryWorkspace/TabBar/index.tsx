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
  index       : number;
  selected    : boolean;
  isFocusable : boolean;
  setRef      : (index: number, el: HTMLButtonElement | null) => void;
  onTabClick  : (tab: Tab) => void;
  onCloseTab  : (tabId: UUIDv7) => void | Promise<void>;
  beginDrag   : (tabId: UUIDv7, clientX: number) => void;
  updateDrag  : (clientX: number) => void;
  endDrag     : () => void;
  isDragging  : boolean;
};

// AIDEV-NOTE: Persist horizontal scroll position per opspace so that TabBar can
// restore the user's scroll offset across QueryWorkspace remounts (route changes
// between different dataQueryIds in the same opspace).
const lastScrollLeftByOpSpace = new Map<string, number>();

const TabButton = memo(function TabButton({
  tab,
  index,
  selected,
  isFocusable,
  onTabClick,
  onCloseTab,
  setRef,
  beginDrag,
  updateDrag,
  endDrag,
  isDragging
}: TabButtonProps) {
  const handleSetRef = useCallback((el: HTMLButtonElement | null) => {
    setRef(index, el);
  }, [setRef, index]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-tab-close="true"]')) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    beginDrag(tab.tabId, e.clientX);
  }, [beginDrag, tab.tabId]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!(e.buttons & 1)) return;
    updateDrag(e.clientX);
  }, [updateDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    endDrag();
  }, [endDrag]);

  const handlePointerCancel = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return (
    <button
      id={`tab-${tab.tabId}`}
      role="tab"
      aria-selected={selected}
      aria-controls={`panel-${tab.tabId}`}
      tabIndex={isFocusable ? 0 : -1}
      className={`${styles['tab']} ${isDragging ? styles['tab-dragging'] : ''}`}
      ref={handleSetRef}
      onClick={() => onTabClick(tab)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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

  const { tabById } = useMemo(() => {
    const idMap = new Map<UUIDv7, Tab>();
    tabs.forEach((tab) => {
      idMap.set(tab.tabId, tab);
    });
    return { tabById: idMap };
  }, [tabs]);

  const getButtonEl = useCallback((tabId: UUIDv7) => {
    return refsMap.current.get(tabId) || null;
  }, []);

  const handleSetRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    const tab = tabs[index];
    if (!tab) return;
    refsMap.current.set(tab.tabId, el);
    setTabRef(index, el);
  }, [tabs, setTabRef]);

  const onActivateTabAction = useCallback((tabId: UUIDv7) => {
    const tab = tabById.get(tabId);
    if (tab) {
      if (onTabActivateForDrag) {
        onTabActivateForDrag(tab);
      } else {
        onTabClick(tab);
      }
    }
  }, [tabById, onTabActivateForDrag, onTabClick]);

  const {
    draggingTabId,
    dropSeparatorIndex,
    beginDrag,
    updateDrag,
    endDrag
  } = useTabDragAndDrop({
    tabs,
    activeTabId,
    onActivateTabAction,
    getButtonElAction: getButtonEl,
    onCommitOrderAction: onReorderTabs
  });

  // AIDEV-NOTE: Ref to avoid stale closures for scroll persistence key.
  const opspaceKeyRef = useRef(String(opspaceId || ''));
  opspaceKeyRef.current = String(opspaceId || '');

  // AIDEV-NOTE: Combined scroll restoration + scroll-into-view.
  // useLayoutEffect ensures adjustments happen before paint, avoiding a flash
  // at scrollLeft=0 followed by a jump to the active tab.
  useLayoutEffect(() => {
    const container = tablistRef.current;
    if (!container) return;

    const key = opspaceKeyRef.current;

    // 1) Restore prior scroll position for this opspace, if any.
    const lastScrollLeft = lastScrollLeftByOpSpace.get(key);
    if (typeof lastScrollLeft === 'number' && lastScrollLeft > 0) {
      container.scrollLeft = lastScrollLeft;
    }

    // 2) If content does not overflow horizontally, skip further work.
    if (container.scrollWidth <= container.clientWidth + 1) return;

    // 3) Determine which tab button we want to ensure is visible.
    if (tabs.length === 0) return;

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

    if (!targetButton) return;

    const containerRect = container.getBoundingClientRect();
    const buttonRect = targetButton.getBoundingClientRect();

    const intersectionWidth = Math.min(buttonRect.right, containerRect.right) - Math.max(buttonRect.left, containerRect.left);
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
    if (isFullyVisible) return;

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

    // 4) Persist the new scroll offset so subsequent remounts within this
    // opspace start from the same visible region.
    try {
      lastScrollLeftByOpSpace.set(key, container.scrollLeft);
    } catch {}
  }, [opspaceId, tabs.length, activeTabId, focusedTabIndex]);

  const handleTablistScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    try {
      lastScrollLeftByOpSpace.set(opspaceKeyRef.current, e.currentTarget.scrollLeft);
    } catch {}
  }, []);

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
        onScroll={handleTablistScroll}
      >
        {tabs.map((tab, index) => {
          const selected = tab.tabId === activeTabId;
          const isFocusable = index === focusedTabIndex;
          const isDragging = draggingTabId === tab.tabId;
          const isLastTab = index === tabs.length - 1;
          const separatorIndex = index + 1;
          const isSeparatorDropTarget = draggingTabId
            && dropSeparatorIndex === separatorIndex;

          return (
            <Fragment key={tab.tabId}>
              <TabButton
                tab={tab}
                index={index}
                selected={selected}
                isFocusable={isFocusable}
                onTabClick={onTabClick}
                onCloseTab={onCloseTab}
                setRef={handleSetRef}
                beginDrag={beginDrag}
                updateDrag={updateDrag}
                endDrag={endDrag}
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
