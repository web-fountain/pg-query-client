'use client';

import type { TreeNode }                  from '@Redux/records/queryTree/types';
import type { UUIDv7 }                    from '@Types/primitives';

import { useTree }                        from '@headless-tree/react';
import {
  asyncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature,
  dragAndDropFeature,
  expandAllFeature
}                                         from '@headless-tree/core';

import { useReduxDispatch }               from '@Redux/storeHooks';
import { getQueryTreeNodeChildrenThunk }  from '@Redux/records/queryTree/thunks';

import {
  createLoadingItemData as adapterCreateLoadingItemData,
  getItemName as adapterGetItemName,
  isItemFolder as adapterIsItemFolder
}                                         from '../adapters/treeItemAdapter';


type DndConfig = {
  canDrag         : (items: any[]) => boolean;
  canDrop         : (items: any[], target: any) => boolean;
  onDrop          : (items: any[], target: any) => void | Promise<void>;
  openOnDropDelay : number;
};

type Args = {
  rootId        : string;
  indent        : number;
  queryTreeRef  : React.RefObject<any>;
  dnd           : DndConfig;
};

function useHeadlessTree({ rootId, indent, queryTreeRef, dnd }: Args) {
  const dispatch = useReduxDispatch();

  const tree = useTree<TreeNode>({
    rootItemId: rootId,
    indent, // AIDEV-NOTE: The library computes left offset per row from this indent; we keep row styles from item.getProps()
    getItemName: (item) => adapterGetItemName(item as any),
    isItemFolder: (item) => adapterIsItemFolder(item as any),
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature, expandAllFeature],
    dataLoader: {
      getItem: async (nodeId) => {
        // AIDEV-NOTE: Read from ref instead of closure to get latest data.
        const item = (queryTreeRef.current as any)?.nodes?.[nodeId as UUIDv7];
        return item as TreeNode;
      },
      getChildrenWithData: async (nodeId) => {
        const currentTree = queryTreeRef.current as any;
        const childrenNodeIds = currentTree?.childrenByParentId?.[nodeId as UUIDv7];

        // If children are already in the tree, return them
        if (childrenNodeIds !== undefined) {
          const rows = (childrenNodeIds || []).map((cid: string) => ({ id: cid, data: currentTree.nodes[cid] }));
          return rows as { id: string; data: TreeNode }[];
        }

        // AIDEV-NOTE: Children not present — fetch from backend for this node (including root).
        const children = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId })).unwrap();
        return (children || []).map((cid: TreeNode) => ({ id: cid.nodeId, data: cid })) as { id: string; data: TreeNode }[];
      }
    },
    // AIDEV-NOTE: Expanded root so the library constructs items on mount/remount.
    // AIDEV-NOTE: Combined with the hydration reload + invalidate below, this avoids the library sticking to an initial "empty" cache.
    initialState: { expandedItems: [rootId], selectedItems: [rootId], focusedItem: rootId },
    createLoadingItemData: () => adapterCreateLoadingItemData() as unknown as TreeNode,
    // AIDEV-NOTE: DnD configuration per headless-tree docs: https://headless-tree.lukasbach.com/features/dnd/
    // For saved QueryTree we support **file/folder → folder/root** moves. Explicit manual reordering is
    // not persisted (server sorts folders-first A→Z), so we do not model reorder-on-drop.
    canDrag: dnd.canDrag,
    canDrop: dnd.canDrop,
    openOnDropDelay: dnd.openOnDropDelay,
    onDrop: dnd.onDrop
  });

  return tree;
}


export { useHeadlessTree };
