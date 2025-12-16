import type { QueryTree, TreeNode } from '@Types/queryTree';
import type { UnsavedQueryTree }    from '@Types/unsavedQueryTree';


// AIDEV-NOTE: Backend API response shapes for query-tree server actions.
export type BuildInitialQueryTreeApiResponse =
  | { ok: false }
  | { ok: true; data: QueryTree };

export type BuildInitialUnsavedQueryTreeApiResponse =
  | { ok: false }
  | { ok: true; data: UnsavedQueryTree };

export type QueryTreeNodeChildren = {
  node      : TreeNode;
  children  : TreeNode[];
};

// AIDEV-NOTE: Backend API shape for creating a new query folder in the saved QueryTree.
export type CreateQueryFolderPayload = {
  parentFolderId? : string;
  name            : string;
};

export type CreateQueryFolderResult = TreeNode;

export type CreateQueryFolderApiResponse =
  | { ok: false }
  | { ok: true; data: CreateQueryFolderResult };

// AIDEV-NOTE: Backend API shape for moving an existing QueryTree node (e.g., file → folder).
// The backend enforces invariants such as "target must be a folder", no cycles, and
// cross-section/depth constraints; client treats the returned TreeNode as authoritative.
export type MoveQueryTreeNodePayload = {
  nodeId          : string;
  newParentNodeId : string;
};

export type MoveQueryTreeNodeResult = {
  nodeId                : string;
  parentNodeId          : string;
  previousParentNodeId  : string;
};

export type MoveQueryTreeNodeApiResponse =
  | { ok: false }
  | { ok: true; data: MoveQueryTreeNodeResult };
