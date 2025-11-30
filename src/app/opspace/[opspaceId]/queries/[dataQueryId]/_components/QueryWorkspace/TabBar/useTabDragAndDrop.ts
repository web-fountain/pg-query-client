'use client';

import type { UUIDv7 }                    from '@Types/primitives';
import { useCallback, useRef, useState }  from 'react';


type DragState = {
  activeTabId: UUIDv7 | null;
  draggingTabId: UUIDv7 | null;
  startX: number;
  currentX: number;
  startOrder: UUIDv7[];
  targetOrder: UUIDv7[];
  didMove: boolean;
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
  renderOrder: UUIDv7[] | null;
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
  const [renderOrder, setRenderOrder] = useState<UUIDv7[] | null>(null);
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
      targetOrder: order,
      didMove: false,
      pendingX: undefined,
      rafId: null
    };
    setDraggingTabId(tabId);
    setRenderOrder(order);
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

      // AIDEV-NOTE: Use the last computed targetOrder as the working order during a drag.
      const baseOrder = s.targetOrder && s.targetOrder.length === s.startOrder.length
        ? s.targetOrder
        : s.startOrder;

      const metas = baseOrder.map((id) => {
        const el = getButtonElAction(id);
        const rect = el ? el.getBoundingClientRect() : new DOMRect();
        return { tabId: id, rect };
      });

      // AIDEV-NOTE: Sort by actual DOM x-position so index arithmetic matches visual order.
      const sorted = metas.slice().sort((a, b) => a.rect.left - b.rect.left);
      const orderIds = sorted.map((m) => m.tabId);
      const fromIndex = orderIds.indexOf(draggingId);
      if (fromIndex === -1) return;

      const dragCenter = x;

      let targetIndex = fromIndex;
      sorted.forEach((m, idx) => {
        const mid = m.rect.left + m.rect.width / 2;
        if (dragCenter > mid) {
          targetIndex = Math.max(targetIndex, idx + 1);
        } else if (dragCenter < mid) {
          targetIndex = Math.min(targetIndex, idx);
        }
      });

      if (targetIndex === fromIndex) {
        s.targetOrder = orderIds;
        return;
      }

      const next = orderIds.slice();
      next.splice(fromIndex, 1);
      next.splice(targetIndex, 0, draggingId);
      s.targetOrder = next;
      setRenderOrder(next);
    });
  }, [getButtonElAction]);

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state) {
      return;
    }

    const startOrder = state.startOrder;
    const targetOrder = state.targetOrder;
    const didMove = state.didMove;
    const currentDraggingId = state.draggingTabId;

    if (state.rafId != null) {
      try { window.cancelAnimationFrame(state.rafId); } catch {}
    }

    dragRef.current = null;
    setDraggingTabId(null);
    setRenderOrder(null);

    if (!didMove || !currentDraggingId) {
      return;
    }

    const changed = startOrder.length !== targetOrder.length
      || startOrder.some((id, idx) => id !== targetOrder[idx]);

    if (!changed) return;

    onCommitOrderAction(targetOrder);
  }, [onCommitOrderAction]);

  return {
    draggingTabId,
    renderOrder,
    beginDrag,
    updateDrag,
    endDrag
  };
}
