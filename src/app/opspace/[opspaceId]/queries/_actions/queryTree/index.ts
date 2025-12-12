'use server';

import type { QueryTree, TreeNode } from '@Types/queryTree';
import type { UnsavedQueryTree }    from '@Types/unsavedQueryTree';
import type { HeadersContext }      from '@Utils/backendFetch';

import { cacheLife, cacheTag }      from 'next/cache';
import {
  backendFetchJSON,
  getHeadersContextOrNull
}                                   from '@Utils/backendFetch';


type ResponsePayload01 =
  | { ok: false; }
  | { ok: true; data: QueryTree; };

// AIDEV-NOTE: Cached initial query tree per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('tree:children:...').
async function buildInitialQueryTreeCached(ctx: HeadersContext): Promise<QueryTree | null> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });

  cacheTag(`tree:children:${ctx.opspacePublicId}:buildInitialQueryTree`);

  const { ok, data } = await backendFetchJSON<ResponsePayload01>({
    path    : '/queries/tree',
    method  : 'GET',
    scope   : ['queries-tree:read'],
    logLabel: 'buildInitialQueryTree',
    context : ctx
  });

  if (!ok || !data?.ok) {
    return null;
  }

  return data.data;
}

export async function buildInitialQueryTree(): Promise<{ success: boolean; data?: QueryTree }> {
  console.log('[ACTION] buildInitialQueryTree');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const tree = await buildInitialQueryTreeCached(ctx);
  if (!tree) {
    return { success: false };
  }

  return { success: true, data: tree };
}

type ResponsePayload02 =
  | { ok: false; }
  | { ok: true; data: UnsavedQueryTree; };

// AIDEV-NOTE: Cached initial unsaved query tree per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('tree:children:...').
async function buildInitialUnsavedQueryTreeCached(ctx: HeadersContext): Promise<UnsavedQueryTree | null> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });

  cacheTag(`tree:children:${ctx.opspacePublicId}:buildInitialUnsavedQueryTree`);

  const { ok, data } = await backendFetchJSON<ResponsePayload02>({
    path    : '/queries/tree/unsaved',
    method  : 'GET',
    scope   : ['queries-tree-unsaved:read'],
    logLabel: 'buildInitialUnsavedQueryTree',
    context : ctx
  });

  console.log('[RESPONSE] buildInitialUnsavedQueryTree', data);

  if (!ok || !data?.ok) {
    return null;
  }

  return data.data;
}

export async function buildInitialUnsavedQueryTree(): Promise<{ success: boolean; data?: UnsavedQueryTree }> {
  console.log('[ACTION] buildInitialUnsavedQueryTree');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const tree = await buildInitialUnsavedQueryTreeCached(ctx);
  if (!tree) {
    return { success: false };
  }

  return { success: true, data: tree };
}

export type QueryTreeNodeChildren = {
  node    : TreeNode;
  children: TreeNode[];
};

const root = { id: 'queries', kind: 'folder', name: 'QUERIES' };

// AIDEV-NOTE: Cache full tree payload; callers slice it to a node's children.
// Tag is invalidated by updateTag(`tree:children:${opspacePublicId}:queries`) on writes.
async function getQueryTreeCached(ctx: HeadersContext): Promise<QueryTree | null> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });
  cacheTag(`tree:children:${ctx.opspacePublicId}:queries`);

  const { ok, data } = await backendFetchJSON<QueryTree>({
    path    : '/queries/tree/children',
    method  : 'GET',
    scope   : ['queries-tree:read'],
    logLabel: 'getQueryTree',
    context : ctx
  });

  if (!ok || !data) {
    return null;
  }

  return data;
}

export async function getQueryTreeNodeChildren(nodeId?: string): Promise<QueryTreeNodeChildren> {
  console.log('[ACTION] getQueryTreeNodeChildren');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { node: root as unknown as TreeNode, children: [] } as QueryTreeNodeChildren;
  }

  const tree = await getQueryTreeCached(ctx);
  if (!tree) {
    return { node: root as unknown as TreeNode, children: [] } as QueryTreeNodeChildren;
  }

  const nid = nodeId ?? 'queries';
  return {
    node    : (tree.nodes[nid as any] ?? root) as unknown as TreeNode,
    children: (tree.childrenByParentId[nid as any] ?? []).map((id: string) => tree.nodes[id as any] as unknown as TreeNode)
  } as QueryTreeNodeChildren;
}
