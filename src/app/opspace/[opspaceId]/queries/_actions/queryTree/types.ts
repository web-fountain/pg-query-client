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
  node: TreeNode;
  children: TreeNode[];
};
