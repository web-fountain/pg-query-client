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
// We also refine childrenByParentId to use string[] for nodeIds, since nodes
// are keyed by string at runtime even when some ids are branded UUIDv7.
type QueryTreeRecord = Omit<QueryTree, 'childrenByParentId'> & {
  childrenByParentId    : { [parentNodeId: string | UUIDv7]: string[] };
  pendingInvalidations? : PendingInvalidations;
};

type NodePlacement = {
  root      : string;
  groupdId  : number;
  tabId     : UUIDv7;
  sortKey   : string;
  position  : number;
};

// AIDEV-NOTE: Minimal shape required for collation-aware comparisons.
// Shared between reducer helpers and queryTree/sort utilities.
type ComparableNode = {
  nodeId    : string;
  kind      : 'folder' | 'file';
  name      : string;
  sortKey?  : string;
};

// AIDEV-NOTE: Payload for lazy children thunks (e.g., getQueryTreeNodeChildrenThunk).
type GetNodeChildrenArgs = {
  nodeId: string;
};


export type {
  ComparableNode,
  GetNodeChildrenArgs,
  NodePlacement,
  PendingInvalidations,
  QueryTreeRecord,
  QueryTreeNode,
  TreeNode
};
