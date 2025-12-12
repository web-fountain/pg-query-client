'use server';

import type { QueryTree, TreeNode } from '@Types/queryTree';
import type { UnsavedQueryTree }    from '@Types/unsavedQueryTree';
import type { HeadersContext }      from '@Utils/backendFetch';
import type { ActionResult }        from '../types';
import type {
  BuildInitialQueryTreeApiResponse,
  BuildInitialUnsavedQueryTreeApiResponse,
  QueryTreeNodeChildren
}                                   from './types';

import { cacheLife, cacheTag }      from 'next/cache';
import { withAction }               from '@Observability/server/action';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail, ok
}                                   from '@Errors/server/actionResult.server';
import { backendFetchJSON }         from '@Utils/backendFetch';
import {
  queryTreeChildrenTag,
  queryTreeInitialTag,
  unsavedQueryTreeInitialTag
}                                   from '../tags';


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
