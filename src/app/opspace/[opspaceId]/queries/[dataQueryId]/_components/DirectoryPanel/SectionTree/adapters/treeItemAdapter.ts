import type { TreeNode } from '@Redux/records/queryTree/types';
import type { TreeItemApi } from '../types';

// AIDEV-NOTE: Adapter functions that translate TreeNode and item API into the
// shapes expected by Headless Tree configuration points. These are pure functions.

export function getItemName(item: TreeItemApi<TreeNode>): string {
  const data = item.getItemData();
  return (data && (data as any).label) ? (data as any).label as string : item.getId();
}

export function isItemFolder(item: TreeItemApi<TreeNode>): boolean {
  // AIDEV-NOTE: Enforce depth rule — no folders at level >= 4. Treat as file.
  const level = (item.getItemMeta()?.level ?? 0) as number;
  // AIDEV-NOTE: Library meta level appears 0-based relative to visible rows; aria-level is 1-based.
  // To block folders at aria-level=4, we disallow meta level >= 3.
  if (level >= 3) return false;
  return item.getItemData()?.kind === 'folder';
}

export function createLoadingItemData(): TreeNode {
  // AIDEV-NOTE: Provide a TreeNode-shaped placeholder to avoid downstream key errors
  return {
    nodeId       : 'loading',
    parentNodeId : null,
    kind         : 'folder',
    label        : 'Loading…',
    sortKey      : '0|loading',
    mountId      : 'loading'
  } as TreeNode;
}
