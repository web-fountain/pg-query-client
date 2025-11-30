'use client';

import { useCallback, useRef, useState } from 'react';
import type { UUIDv7 } from '@Types/primitives';


type DragState = {
  activeTabId: UUIDv7 | null;
  draggingTabId: UUIDv7 | null;
  startX: number;
  currentX: number;
  startOrder: UUIDv7[];
  targetOrder: UUIDv7[];
  didMove: boolean;
};

type UseTabDragAndDropArgs = {
  tabs: { tabId: UUIDv7 }[];
  activeTabId: string;
  getButtonEl: (tabId: UUIDv7) => HTMLButtonElement | null;
  onActivateTab: (tabId: UUIDv7) => void;
  onCommitOrder: (tabIds: UUIDv7[]) => void;
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
  getButtonEl,
  onActivateTab,
  onCommitOrder
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
      didMove: false
    };
    setDraggingTabId(tabId);
    setRenderOrder(order);
  }, [tabs, activeTabId]);

  const updateDrag = useCallback((clientX: number) => {
    const state = dragRef.current;
    if (!state || !state.draggingTabId) return;

    state.currentX = clientX;
    const deltaX = clientX - state.startX;

    const fromOrder = state.startOrder;
    const draggingId = state.draggingTabId;
    const fromIndex = fromOrder.indexOf(draggingId);
    if (fromIndex === -1) return;

    if (!state.didMove && Math.abs(deltaX) < thresholdPx) {
      return;
    }

    if (!state.didMove) {
      state.didMove = true;
      if (draggingId !== (state.activeTabId || null)) {
        // AIDEV-NOTE: Enforce rule that a tab must be active/focused before reordering.
        onActivateTab(draggingId);
      }
    }

    const metas = fromOrder.map((id, index) => {
      const el = getButtonEl(id);
      const rect = el ? el.getBoundingClientRect() : new DOMRect();
      return { tabId: id, index, rect };
    });

    const meta = metas.find((m) => m.tabId === draggingId);
    if (!meta || !meta.rect) return;

    const dragCenter = meta.rect.left + meta.rect.width / 2 + deltaX;

    let targetIndex = fromIndex;
    for (const m of metas) {
      const mid = m.rect.left + m.rect.width / 2;
      if (dragCenter > mid) {
        targetIndex = Math.max(targetIndex, m.index + 1);
      } else if (dragCenter < mid) {
        targetIndex = Math.min(targetIndex, m.index);
      }
    }

    if (targetIndex === fromIndex) {
      state.targetOrder = fromOrder;
      setRenderOrder(fromOrder);
      return;
    }

    const next = fromOrder.slice();
    next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, draggingId);
    state.targetOrder = next;
    setRenderOrder(next);
  }, [getButtonEl, onActivateTab]);

  const endDrag = useCallback(() => {
    const state = dragRef.current;
    if (!state) {
      return;
    }

    const startOrder = state.startOrder;
    const targetOrder = state.targetOrder;
    const didMove = state.didMove;
    const currentDraggingId = state.draggingTabId;

    dragRef.current = null;
    setDraggingTabId(null);
    setRenderOrder(null);

    if (!didMove || !currentDraggingId) {
      return;
    }

    const changed = startOrder.length !== targetOrder.length
      || startOrder.some((id, idx) => id !== targetOrder[idx]);

    if (!changed) return;

    onCommitOrder(targetOrder);
  }, [onCommitOrder]);

  return {
    draggingTabId,
    renderOrder,
    beginDrag,
    updateDrag,
    endDrag
  };
}
