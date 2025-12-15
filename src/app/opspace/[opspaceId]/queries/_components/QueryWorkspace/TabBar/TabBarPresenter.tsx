'use client';

import type { UUIDv7 }        from '@Types/primitives';
import type { Tab }           from './index';

import {
  Fragment, memo, useCallback,
  useEffect, useLayoutEffect,
  useRef
}                             from 'react';
import Icon                   from '@Components/Icons';

import { useTabDragAndDrop }  from './useTabDragAndDrop';
import styles                 from './styles.module.css';


type PresenterProps = {
  tabs            : Tab[];
  activeTabId     : string;
  focusedTabIndex : number;
  onAddTab        : () => void;
  onCloseTab      : (tabId: UUIDv7) => void | Promise<void>;
  onKeyDown       : (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPointerDown   : (tab: Tab) => void;
  onReorderTabs   : (tabIds: UUIDv7[]) => void;
  onTabClick      : (tab: Tab) => void;
};

type TabButtonProps = {
  index       : number;
  isDragging  : boolean;
  isFocusable : boolean;
  selected    : boolean;
  tab         : Tab;
  beginDrag   : (tabId: UUIDv7, clientX: number) => void;
  endDrag     : () => void;
  onCloseTab  : (tabId: UUIDv7) => void | Promise<void>;
  onPointerDownActivate?: (tab: Tab) => void;
  onTabClick  : (tab: Tab) => void;
  setRef      : (index: number, el: HTMLButtonElement | null) => void;
  updateDrag  : (clientX: number) => void;
};

// AIDEV-NOTE: Persist horizontal scroll offset across remounts.
// This presenter doesn't have opspaceId, so the key is best-effort (derived from activeTabId).
const lastScrollLeftByKey = new Map<string, number>();

const TabButton = memo(function TabButton({
  tab,
  index,
  selected,
  isFocusable,
  onTabClick,
  onCloseTab,
  setRef,
  onPointerDownActivate,
  beginDrag,
  updateDrag,
  endDrag,
  isDragging
}: TabButtonProps) {
  // AIDEV-NOTE: Tabs use pointer events for DnD. Some browsers will suppress `click`
  // when a pointer gesture is interpreted as a drag. We therefore also activate the tab
  // on pointer-up when the gesture did not move beyond a small threshold.
  const pointerStartRef       = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef  = useRef(false);
  const dragThresholdPx       = 10;

  const handleSetRef = useCallback((el: HTMLButtonElement | null) => {
    setRef(index, el);
  }, [setRef, index]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-tab-close="true"]')) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    try { onPointerDownActivate?.(tab); } catch {}
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    beginDrag(tab.tabId, e.clientX);
  }, [beginDrag, onPointerDownActivate, tab]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!(e.buttons & 1)) return;
    updateDrag(e.clientX);
  }, [updateDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLElement;
    const isClose = !!target?.closest?.('[data-tab-close="true"]');
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    const dx = start ? Math.abs(e.clientX - start.x) : 0;
    // AIDEV-NOTE: Tab DnD is horizontal; tolerate vertical jitter so "clicks" don't get dropped.
    const isClickGesture = !isClose && dx < dragThresholdPx;

    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    endDrag();

    if (isClickGesture) {
      // AIDEV-NOTE: Prevent double-activation when `click` also fires.
      suppressNextClickRef.current = true;
      try { window.setTimeout(() => { suppressNextClickRef.current = false; }, 0); } catch {}
      onTabClick(tab);
    }
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
      onClick={() => {
        if (suppressNextClickRef.current) return;
        onTabClick(tab);
      }}
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

function TabBarPresenter({
  tabs,
  activeTabId,
  focusedTabIndex,
  onTabClick,
  onPointerDown,
  onKeyDown,
  onAddTab,
  onCloseTab,
  onReorderTabs
}: PresenterProps) {
  // AIDEV-NOTE: Map tabId → button element for roving focus + DnD geometry.
  const rootRef    = useRef<HTMLDivElement | null>(null);
  const refsMap    = useRef<Map<UUIDv7, HTMLButtonElement | null>>(new Map());
  const tablistRef = useRef<HTMLDivElement | null>(null);

  const handleTablistClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Ignore clicks that originated from a real tab button or the close affordance.
    if (target.closest('[data-tab-close="true"]')) return;
    if (target.closest('[role="tab"]')) return;

    // AIDEV-NOTE: If the user clicks the gap between tabs, activate the nearest tab.
    // This prevents "nothing happens" reports caused by separators/margins in the tab strip.
    const x = e.clientX;
    let best: Tab | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const tab of tabs) {
      const el = refsMap.current.get(tab.tabId) || null;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const dist = Math.abs(x - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = tab;
      }
    }

    if (best) {
      try { onTabClick(best); } catch {}
    }
  }, [tabs, onTabClick]);

  const {
    draggingTabId,
    dropSeparatorIndex,
    beginDrag,
    updateDrag,
    endDrag
  } = useTabDragAndDrop({
    tabs,
    activeTabId,
    getButtonElAction: (tabId: UUIDv7) => refsMap.current.get(tabId) || null,
    onCommitOrderAction: onReorderTabs
  });

  // AIDEV-NOTE: Keep DOM focus synced with Redux roving tabindex (keyboard nav) without refocusing on renames.
  useEffect(() => {
    // AIDEV-NOTE: Do not steal focus when the user is interacting elsewhere (e.g. directory tree).
    // Only apply roving focus while focus is already within the TabBar.
    try {
      const root = rootRef.current;
      const active = document.activeElement as Node | null;
      if (root && active && !root.contains(active)) return;
      if (root && !active) return;
    } catch {
      // If we can't inspect focus, prefer not stealing it.
      return;
    }

    const count = tabs.length;
    if (count === 0) return;

    const clamped = (((focusedTabIndex || 0) % count) + count) % count;
    const focusedTab = tabs[clamped];
    if (!focusedTab) return;

    const btn = refsMap.current.get(focusedTab.tabId) || null;
    if (!btn) return;

    try {
      (btn as any).focus?.({ preventScroll: true });
    } catch {
      try { btn.focus(); } catch {}
    }
    // AIDEV-NOTE: Depend only on focusedTabIndex/tabs.length so we don't steal focus (e.g., Toolbar input) on renames.
  }, [focusedTabIndex, tabs.length]);

  const handleSetRef = useCallback((index: number, el: HTMLButtonElement | null) => {
    const tab = tabs[index];
    if (!tab) return;
    refsMap.current.set(tab.tabId, el);
  }, [tabs]);

  // AIDEV-NOTE: Scroll persistence key (best-effort stand-in for opspaceId).
  const scrollKeyRef = useRef<string>('');
  scrollKeyRef.current = activeTabId ? String(activeTabId).slice(0, 8) : scrollKeyRef.current;

  // AIDEV-NOTE: Restore scrollLeft and ensure focused/active tab is visible. useLayoutEffect avoids paint-jump.
  useLayoutEffect(() => {
    const container = tablistRef.current;
    if (!container) return;

    const key = scrollKeyRef.current;

    const lastScrollLeft = lastScrollLeftByKey.get(key);
    if (typeof lastScrollLeft === 'number' && lastScrollLeft > 0) {
      container.scrollLeft = lastScrollLeft;
    }

    if (container.scrollWidth <= container.clientWidth + 1) return;

    if (tabs.length === 0) return;

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
    const buttonRect    = targetButton.getBoundingClientRect();

    const intersectionWidth = Math.min(buttonRect.right, containerRect.right) - Math.max(buttonRect.left, containerRect.left);
    const tabWidth          = buttonRect.width;

    // AIDEV-NOTE: Use intersection width to detect full visibility (epsilon accounts for subpixel rounding).
    const epsilon         = 1;
    const isOffscreen     = intersectionWidth <= 0;
    const isFullyVisible  = !isOffscreen && intersectionWidth >= (tabWidth - epsilon);

    // AIDEV-NOTE: Don't scroll if already fully visible; avoids horizontal jump on activation.
    if (isFullyVisible) return;

    try {
      targetButton.scrollIntoView({
        behavior  : 'auto',
        block     : 'nearest',
        inline    : 'nearest'
      });
    } catch {
      // AIDEV-NOTE: Fallback for browsers without scrollIntoView options.
      targetButton.scrollIntoView();
    }

    try {
      lastScrollLeftByKey.set(key, container.scrollLeft);
    } catch {}
  }, [tabs.length, activeTabId, focusedTabIndex]);

  const handleTablistScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    try {
      lastScrollLeftByKey.set(scrollKeyRef.current, e.currentTarget.scrollLeft);
    } catch {}
  }, []);

  return (
    <div
      ref={rootRef}
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
        onClick={handleTablistClick}
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
                onPointerDownActivate={onPointerDown}
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
};


export default memo(TabBarPresenter);
