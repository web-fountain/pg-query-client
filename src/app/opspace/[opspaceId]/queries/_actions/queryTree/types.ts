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
