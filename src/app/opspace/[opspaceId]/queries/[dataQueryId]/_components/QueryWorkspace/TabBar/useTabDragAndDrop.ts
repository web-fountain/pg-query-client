'use client';

import type { UUIDv7 }                    from '@Types/primitives';
import { useCallback, useRef, useState }  from 'react';


type DragState = {
  activeTabId: UUIDv7 | null;
  draggingTabId: UUIDv7 | null;
  startX: number;
  currentX: number;
  startOrder: UUIDv7[];
  didMove: boolean;
  // AIDEV-NOTE: Boundary index in [0..tabs.length] representing the gap where the tab would be inserted.
  boundaryIndex: number | null;
  pendingX?: number;
  rafId?: number | null;
};

type UseTabDragAndDropArgs = {
  tabs: { tabId: UUIDv7 }[];
  activeTabId: string;
  getButtonElAction: (tabId: UUIDv7) => HTMLButtonElement | null;
  onActivateTabAction: (tabId: UUIDv7) => void;
  onCommitOrderAction: (tabIds: UUIDv7[]) => void;
};

type UseTabDragAndDropResult = {
  draggingTabId: UUIDv7 | null;
  // AIDEV-NOTE: Separator index in [0..tabs.length]; used only for visual drop indication.
  dropSeparatorIndex: number | null;
  beginDrag: (tabId: UUIDv7, clientX: number) => void;
  updateDrag: (clientX: number) => void;
  endDrag: () => void;
};


// AIDEV-NOTE: Pointer-based horizontal DnD for the tab strip; keeps Redux as source of truth.
export function useTabDragAndDrop({
  tabs,
  activeTabId,
  getButtonElAction,
  onActivateTabAction,
  onCommitOrderAction
}: UseTabDragAndDropArgs): UseTabDragAndDropResult {
  const [draggingTabId, setDraggingTabId] = useState<UUIDv7 | null>(null);
  const [dropSeparatorIndex, setDropSeparatorIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const thresholdPx = 4;

  const beginDrag = useCallback((tabId: UUIDv7, clientX: number) => {
    const order = (tabs || []).map((t) => t.tabId);
    dragRef.current = {
      activeTabId: (activeTabId || null) as UUIDv7 | null,
      draggingTabId: tabId,
      startX: clientX,
      currentX: clientX,
      startOrder: order,
      didMove: false,
      boundaryIndex: null,
      pendingX: undefined,
      rafId: null
    };
    setDraggingTabId(tabId);
    setDropSeparatorIndex(null);
    // AIDEV-NOTE: Activate tab immediately on press to enable fluid press-and-drag from inactive tabs.
    if (tabId !== (activeTabId || null)) {
      onActivateTabAction(tabId);
    }
  }, [tabs, activeTabId]);

  const updateDrag = useCallback((clientX: number) => {
    const state = dragRef.current;
    if (!state || !state.draggingTabId) return;

    state.pendingX = clientX;
    if (state.rafId != null) {
      return;
    }

    state.rafId = window.requestAnimationFrame(() => {
      const s = dragRef.current;
      if (!s || !s.draggingTabId) {
        if (s) s.rafId = null;
        return;
      }

      const x = s.pendingX ?? clientX;
      s.pendingX = undefined;
      s.rafId = null;

      s.currentX = x;
      const deltaX = x - s.startX;

      const draggingId = s.draggingTabId;
      if (!draggingId) return;

      if (!s.didMove && Math.abs(deltaX) < thresholdPx) {
        return;
      }

      if (!s.didMove) {
        // AIDEV-NOTE: Threshold crossed — treat gesture as a drag from this point on.
        s.didMove = true;
      }

      // AIDEV-NOTE: Compute the visual insertion boundary (0..tabs.length) based on tab midpoints.
      const baseOrder = s.startOrder;
      if (!baseOrder.length) {
        s.boundaryIndex = null;
        setDropSeparatorIndex(null);
        return;
      }

      const metas = baseOrder.map((id) => {
        const el = getButtonElAction(id);
        const rect = el ? el.getBoundingClientRect() : new DOMRect();
        return { tabId: id, rect };
      });

      // AIDEV-NOTE: Sort tabs by actual DOM x-position; this reflects the current visual order.
      const sorted = metas.slice().sort((a, b) => a.rect.left - b.rect.left);
      if (!sorted.length) {
        s.boundaryIndex = null;
        setDropSeparatorIndex(null);
        return;
      }

      const mids = sorted.map((m) => m.rect.left + m.rect.width / 2);
      const dragCenter = x;
      let boundaryIndex = 0;

      if (dragCenter < mids[0]) {
        boundaryIndex = 0;
      } else if (dragCenter >= mids[mids.length - 1]) {
        boundaryIndex = mids.length;
      } else {
        boundaryIndex = mids.length;
        for (let i = 1; i < mids.length; i += 1) {
          if (dragCenter < mids[i]) {
            boundaryIndex = i;
            break;
          }
        }
      }

      if (boundaryIndex === s.boundaryIndex) {
        return;
      }

      s.boundaryIndex = boundaryIndex;
      setDropSeparatorIndex(boundaryIndex);
    });
  }, [getButtonElAction]);

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state) {
      return;
    }

    const startOrder = state.startOrder;
    const didMove = state.didMove;
    const currentDraggingId = state.draggingTabId;
    const boundaryIndex = state.boundaryIndex;

    if (state.rafId != null) {
      try { window.cancelAnimationFrame(state.rafId); } catch {}
    }

    dragRef.current = null;
    setDraggingTabId(null);
    setDropSeparatorIndex(null);

    if (!didMove || !currentDraggingId || boundaryIndex == null) {
      return;
    }

    const fromIndex = startOrder.indexOf(currentDraggingId);
    if (fromIndex === -1) {
      return;
    }

    // AIDEV-NOTE: Convert visual boundary index into final target index for the dragged tab.
    const maxIndex = startOrder.length - 1;
    const clampedBoundary = Math.max(0, Math.min(boundaryIndex, startOrder.length));
    let targetIndex = clampedBoundary;
    if (clampedBoundary > fromIndex) {
      targetIndex = clampedBoundary - 1;
    }
    targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));

    const next = startOrder.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, moved);

    const changed = next.length !== startOrder.length
      || next.some((id, idx) => id !== startOrder[idx]);

    if (changed) {
      onCommitOrderAction(next);
    }
  }, [onCommitOrderAction]);

  return {
    draggingTabId,
    dropSeparatorIndex,
    beginDrag,
    updateDrag,
    endDrag
  };
}
