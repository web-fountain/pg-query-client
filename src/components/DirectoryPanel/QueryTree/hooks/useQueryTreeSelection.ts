'use client';

import { useCallback, useRef } from 'react';
import type { TreeApi }        from '../types';


type Args = {
  tree              : TreeApi<unknown>;
  rootId            : string;
  markTreeFocused?  : () => void;
  setIsTreeFocused? : (v: boolean | ((prev: boolean) => boolean)) => void;
};

type Result = {
  selectTreeItem        : (nodeId: string) => void;
  clearSelectionToRoot  : () => void;
};

function useQueryTreeSelection({ tree, rootId, markTreeFocused, setIsTreeFocused }: Args): Result {
  const pendingClearSelectionRafRef = useRef<number | null>(null);

  const selectTreeItem = useCallback((nodeId: string) => {
    const id = String(nodeId || '');
    if (!id) return;
    try {
      if (typeof tree.setSelectedItems === 'function') {
        tree.setSelectedItems([id]);
      }
    } catch {}

    try {
      tree.setConfig?.((prev: any) => ({
        ...prev,
        state: {
          ...(prev.state || {}),
          focusedItem: id
        }
      }));
    } catch {}

    // AIDEV-NOTE: Treat toolbar-driven create or row click as an explicit tree interaction.
    try {
      markTreeFocused?.();
    } catch {}
  }, [markTreeFocused, tree]);

  const clearSelectionToRoot = useCallback(() => {
    // AIDEV-NOTE: Clear selection to a "no visible selection" sentinel (root is not rendered as a row).
    // Schedule after event processing so headless-tree doesn't overwrite during the same click.
    try {
      if (pendingClearSelectionRafRef.current != null) {
        cancelAnimationFrame(pendingClearSelectionRafRef.current);
      }
    } catch {}

    try {
      pendingClearSelectionRafRef.current = requestAnimationFrame(() => {
        pendingClearSelectionRafRef.current = null;

        try {
          setIsTreeFocused?.(false);
        } catch {}

        try {
          if (typeof tree.setSelectedItems === 'function') {
            tree.setSelectedItems([rootId]);
            // Best-effort: also reset focusedItem. Some headless-tree versions don't reliably accept focusedItem updates.
            try {
              tree.setConfig?.((prev: any) => {
                const prevState = prev.state || {};
                return {
                  ...prev,
                  state: {
                    ...prevState,
                    focusedItem: rootId
                  }
                };
              });
            } catch {}
          } else {
            tree.setConfig?.((prev: any) => {
              const prevState = prev.state || {};
              return {
                ...prev,
                state: {
                  ...prevState,
                  selectedItems: [rootId],
                  focusedItem: rootId
                }
              };
            });
          }
        } catch {}
      });
    } catch {
      // If RAF isn't available for some reason, do best-effort sync.
      try {
        setIsTreeFocused?.(false);
      } catch {}
      try {
        if (typeof tree.setSelectedItems === 'function') {
          tree.setSelectedItems([rootId]);
        }
      } catch {}
    }
  }, [rootId, setIsTreeFocused, tree]);

  return { selectTreeItem, clearSelectionToRoot };
}


export { useQueryTreeSelection };
