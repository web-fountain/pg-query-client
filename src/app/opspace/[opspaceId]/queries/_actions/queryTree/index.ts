'use server';

import type { QueryTree, TreeNode }       from '@Types/queryTree';
import type { UnsavedQueryTree }          from '@Types/unsavedQueryTree';
import type { HeadersContext }            from '@Utils/backendFetch';
import type { ActionResult }              from '../types';
import type {
  BuildInitialQueryTreeApiResponse,
  BuildInitialUnsavedQueryTreeApiResponse,
  QueryTreeNodeChildren,
  CreateQueryFolderApiResponse,
  CreateQueryFolderPayload,
  CreateQueryFolderResult,
  MoveQueryTreeNodeApiResponse,
  MoveQueryTreeNodePayload,
  MoveQueryTreeNodeResult
}                                          from './types';

import { cacheLife, cacheTag, updateTag } from 'next/cache';
import { QUERY_TREE_ROOT_ID }             from '@Redux/records/queryTree/constraints';
import { withAction }                     from '@Observability/server/action';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail, ok
}                                         from '@Errors/server/actionResult.server';
import { backendFetchJSON }               from '@Utils/backendFetch';
import {
  queryTreeChildrenTag,
  queryTreeInitialTag,
  unsavedQueryTreeInitialTag
}                                         from '../tags';


// Cached initial query tree per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('tree:children:...').
type BuildInitialQueryTreeCachedResult =
  | { ok: true; data: QueryTree }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function buildInitialQueryTreeCached(ctx: HeadersContext): Promise<BuildInitialQueryTreeCachedResult> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });

  cacheTag(queryTreeInitialTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<BuildInitialQueryTreeApiResponse>({
    path    : '/queries/tree',
    method  : 'GET',
    scope   : ['queries-tree:read'],
    logLabel: 'buildInitialQueryTreeAction',
    context : ctx
  });

  if (!res.ok) {
    return { ok: false, status: res.status, reason: 'fetch-failed' };
  }

  if (!res.data?.ok) {
    return { ok: false, status: res.status, reason: 'backend-ok-false' };
  }

  return { ok: true, data: res.data.data };
}

export async function buildInitialQueryTreeAction(): Promise<ActionResult<QueryTree>> {
  return withAction(
    { action: 'queryTree.buildInitial', op: 'read' },
    async ({ ctx, meta }) => {
      const tree = await buildInitialQueryTreeCached(ctx);
      if (!tree.ok) {
        if (tree.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to load query tree.',
            request: { path: '/queries/tree', method: 'GET', scope: ['queries-tree:read'], logLabel: 'buildInitialQueryTreeAction' }
          }));
        }

        const isParseFailure = tree.status >= 200 && tree.status < 300;
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : tree.status,
          fallbackMessage : 'Failed to load query tree.',
          request         : { path: '/queries/tree', method: 'GET', scope: ['queries-tree:read'], logLabel: 'buildInitialQueryTreeAction' },
          isParseFailure  : isParseFailure
        }));
      }

      return ok(meta, tree.data);
    }
  );
}

// AIDEV-NOTE: Cached initial unsaved query tree per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('tree:children:...').
type BuildInitialUnsavedQueryTreeCachedResult =
  | { ok: true; data: UnsavedQueryTree }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function buildInitialUnsavedQueryTreeCached(ctx: HeadersContext): Promise<BuildInitialUnsavedQueryTreeCachedResult> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });

  cacheTag(unsavedQueryTreeInitialTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<BuildInitialUnsavedQueryTreeApiResponse>({
    path    : '/queries/tree/unsaved',
    method  : 'GET',
    scope   : ['queries-tree-unsaved:read'],
    logLabel: 'buildInitialUnsavedQueryTreeAction',
    context : ctx
  });

  if (!res.ok) {
    return { ok: false, status: res.status, reason: 'fetch-failed' };
  }

  if (!res.data?.ok) {
    return { ok: false, status: res.status, reason: 'backend-ok-false' };
  }

  return { ok: true, data: res.data.data };
}

export async function buildInitialUnsavedQueryTreeAction(): Promise<ActionResult<UnsavedQueryTree>> {
  return withAction(
    { action: 'queryTree.buildInitialUnsaved', op: 'read' },
    async ({ ctx, meta }) => {
      const tree = await buildInitialUnsavedQueryTreeCached(ctx);
      if (!tree.ok) {
        if (tree.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to load unsaved query tree.',
            request: { path: '/queries/tree/unsaved', method: 'GET', scope: ['queries-tree-unsaved:read'], logLabel: 'buildInitialUnsavedQueryTreeAction' }
          }));
        }

        const isParseFailure = tree.status >= 200 && tree.status < 300;
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : tree.status,
          fallbackMessage : 'Failed to load unsaved query tree.',
          request         : { path: '/queries/tree/unsaved', method: 'GET', scope: ['queries-tree-unsaved:read'], logLabel: 'buildInitialUnsavedQueryTreeAction' },
          isParseFailure  : isParseFailure
        }));
      }

      return ok(meta, tree.data);
    }
  );
}

const root = { id: 'queries', kind: 'folder', name: 'QUERIES' };

// AIDEV-NOTE: Cache full tree payload; callers slice it to a node's children.
// Tag is invalidated by updateTag(`tree:children:${opspacePublicId}:queries`) on writes.
type GetQueryTreeCachedResult =
  | { ok: true; data: QueryTree }
  | { ok: false; status: number };

async function getQueryTreeCached(ctx: HeadersContext): Promise<GetQueryTreeCachedResult> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });
  cacheTag(queryTreeChildrenTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<QueryTree>({
    path    : '/queries/tree/children',
    method  : 'GET',
    scope   : ['queries-tree:read'],
    logLabel: 'getQueryTree',
    context : ctx
  });

  if (!res.ok || !res.data) {
    return { ok: false, status: res.status };
  }

  return { ok: true, data: res.data };
}

export async function getQueryTreeNodeChildrenAction(nodeId?: string): Promise<ActionResult<QueryTreeNodeChildren>> {
  return withAction(
    {
      action : 'queryTree.children',
      op     : 'read',
      input  : { nodeId: nodeId ?? 'queries' }
    },
    async ({ ctx, meta }) => {
      const tree = await getQueryTreeCached(ctx);
      if (!tree.ok) {
        const isParseFailure = tree.status >= 200 && tree.status < 300;
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : tree.status,
          fallbackMessage : 'Failed to load query tree children.',
          request         : { path: '/queries/tree/children', method: 'GET', scope: ['queries-tree:read'], logLabel: 'getQueryTree' },
          isParseFailure  : isParseFailure
        }));
      }

      const nid = nodeId ?? 'queries';
      return ok(meta, {
        node      : (tree.data.nodes[nid as any] ?? root) as unknown as TreeNode,
        children  : (tree.data.childrenByParentId[nid as any] ?? []).map((id: string) => tree.data.nodes[id as any] as unknown as TreeNode)
      } as QueryTreeNodeChildren);
    }
  );
}

// AIDEV-NOTE: Server action to create a new query folder under a given parent node.
// Delegates to the backend, then invalidates cached query tree payloads so future
// reads observe the new folder.
export async function createQueryFolderAction(payload: CreateQueryFolderPayload): Promise<ActionResult<CreateQueryFolderResult>> {
  const { parentFolderId, name } = payload;

  return withAction(
    {
      action : 'queryTree.createFolder',
      op     : 'write',
      input  : {
        parentFolderId,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    },
    async ({ ctx, meta }) => {
      const body = parentFolderId
        ? { parentFolderId, name }
        : { name };

      const res = await backendFetchJSON<CreateQueryFolderApiResponse>({
        // AIDEV-NOTE: Align this path/scope with the backend implementation for folder creation.
        path    : '/queries/tree/folders',
        method  : 'POST',
        scope   : ['queries-tree-folders:write'],
        logLabel: 'createQueryFolderAction',
        context : ctx,
        body
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to create folder.',
          request         : {
            path    : '/queries/tree/folders',
            method  : 'POST',
            scope   : ['queries-tree-folders:write'],
            logLabel: 'createQueryFolderAction'
          }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to create folder.',
          request: {
            path    : '/queries/tree/folders',
            method  : 'POST',
            scope   : ['queries-tree-folders:write'],
            logLabel: 'createQueryFolderAction'
          }
        }));
      }

      // AIDEV-NOTE: Invalidate cached query tree so subsequent reads see the new folder.
      try {
        updateTag(queryTreeInitialTag(ctx.opspacePublicId));
      } catch {}

      try {
        updateTag(queryTreeChildrenTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, res.data.data);
    }
  );
}

// AIDEV-NOTE: Server action to move an existing QueryTree node under a new parent folder.
// This is used by the DirectoryPanel QueryTree for file → folder drag-and-drop. The backend
// is expected to enforce folder-only targets, no cycles, and depth/section constraints.
export async function moveQueryTreeNodeAction(
  payload: MoveQueryTreeNodePayload
): Promise<ActionResult<MoveQueryTreeNodeResult>> {
  const { nodeId, newParentNodeId } = payload;

  return withAction(
    {
      action : 'queryTree.moveNode',
      op     : 'write',
      input  : {
        nodeId,
        newParentNodeId
      }
    },
    async ({ ctx, meta }) => {
      // AIDEV-NOTE: The saved QueryTree root (`queries`) is a synthetic node used by the client.
      // Backend expects "move to root" to omit `newParentNodeId` entirely (send only `{ nodeId }`).
      const body =
        newParentNodeId === QUERY_TREE_ROOT_ID
          ? { nodeId }
          : { nodeId, newParentNodeId };

      const res = await backendFetchJSON<MoveQueryTreeNodeApiResponse>({
        // AIDEV-NOTE: Align this path/scope with the backend implementation for moves.
        path    : '/queries/tree/nodes/move',
        method  : 'PATCH',
        scope   : ['queries-tree-nodes-move:write'],
        logLabel: 'moveQueryTreeNodeAction',
        context : ctx,
        body
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to move query.',
          request         : {
            path    : '/queries/tree/nodes/move',
            method  : 'PATCH',
            scope   : ['queries-tree-nodes-move:write'],
            logLabel: 'moveQueryTreeNodeAction'
          }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to move query.',
          request: {
            path    : '/queries/tree/nodes/move',
            method  : 'PATCH',
            scope   : ['queries-tree-nodes-move:write'],
            logLabel: 'moveQueryTreeNodeAction'
          }
        }));
      }

      // AIDEV-NOTE: Moving a node affects both the initial tree payload and children cache.
      try { updateTag(queryTreeInitialTag(ctx.opspacePublicId)); } catch {}
      try { updateTag(queryTreeChildrenTag(ctx.opspacePublicId)); } catch {}

      return ok(meta, res.data.data);
    }
  );
}
