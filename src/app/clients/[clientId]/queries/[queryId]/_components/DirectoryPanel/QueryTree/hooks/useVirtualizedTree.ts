import { useMemo } from 'react';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';

type AnyTree = {
  getItems: () => Array<any>;
};

export type VirtualizedTreeResult = {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: ReturnType<Virtualizer<HTMLDivElement, Element>['getVirtualItems']>;
};

// AIDEV-NOTE: Virtualizes tree rows with a fixed 28px height and configurable overscan.
export function useVirtualizedTree(
  tree: AnyTree,
  getScrollElement: () => HTMLDivElement | null,
  rowHeightPx = 28,
  overscan = 8
): VirtualizedTreeResult {
  const items = tree.getItems();
  // AIDEV-NOTE: removed console diagnostics after stabilization

  const virtualizer = useVirtualizer({
    count: items.length,
    getItemKey: (index) => items[index]?.getId?.() ?? String(index),
    getScrollElement,
    estimateSize: () => rowHeightPx,
    overscan
  });

  const virtualItems = virtualizer.getVirtualItems();

  return { virtualizer, virtualItems };
}
