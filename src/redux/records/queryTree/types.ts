import type { UUIDv7 }  from '@Types/primitives';
import type {
  QueryTree,
  QueryTreeNode,
  TreeNode
}                       from '@Types/queryTree';


// AIDEV-NOTE: Pending invalidations for headless-tree cache updates.
// Tracked in Redux so the tree component can process them and call
// invalidateItemData() / invalidateChildrenIds() on headless-tree items.
type PendingInvalidations = {
  items   : string[];  // Node IDs needing invalidateItemData()
  parents : string[];  // Parent IDs needing invalidateChildrenIds()
};

// AIDEV-NOTE: Redux-specific extension of the transport type.
// Server returns QueryTree; Redux wraps it with client-only tracking fields.
type QueryTreeRecord = QueryTree & {
  pendingInvalidations?: PendingInvalidations;
};

type NodePlacement = {
  root      : string;
  groupdId  : number;
  tabId     : UUIDv7;
  sortKey   : string;
  position  : number;
}


export type {
  NodePlacement,
  PendingInvalidations,
  QueryTreeRecord,
  QueryTreeNode,
  TreeNode
};
