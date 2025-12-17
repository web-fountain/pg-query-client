'use client';

import type { TreeApi }       from '../types';

import { useEffect }          from 'react';
import { useReduxDispatch }   from '@Redux/storeHooks';
import { clearInvalidations } from '@Redux/records/queryTree';


type Args = {
  tree: TreeApi<unknown>;
  pendingInvalidations: unknown;
};

function useQueryTreeInvalidations({ tree, pendingInvalidations }: Args) {
  const dispatch = useReduxDispatch();

  // AIDEV-NOTE: Process pending invalidations from Redux - O(k) where k = invalidations.
  // This tells headless-tree to refresh its internal cache for affected items.
  useEffect(() => {
    const inv = pendingInvalidations as any;
    if (!inv) return;

    const hasItems = inv.items?.length > 0;
    const hasParents = inv.parents?.length > 0;

    if (!hasItems && !hasParents) return;

    // Capture what we're processing (for race-safe clear)
    const itemsToProcess = [...(inv.items || [])];
    const parentsToProcess = [...(inv.parents || [])];

    // Process item invalidations (label changes)
    for (const nodeId of itemsToProcess) {
      try {
        const item = tree.getItemInstance?.(nodeId);
        item?.invalidateItemData?.();
      } catch {}
    }

    // Process parent invalidations (sort order changes)
    for (const parentId of parentsToProcess) {
      try {
        const item = tree.getItemInstance?.(parentId);
        item?.invalidateChildrenIds?.();
      } catch {}
    }

    // Clear only what we processed (race-safe)
    dispatch(clearInvalidations({ items: itemsToProcess, parents: parentsToProcess }));
  }, [pendingInvalidations, tree, dispatch]);
}


export { useQueryTreeInvalidations };
