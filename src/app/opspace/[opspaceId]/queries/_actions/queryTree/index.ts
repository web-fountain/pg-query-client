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
export async function getQueryTreeNodeChildren(nodeId?: string): Promise<QueryTreeNodeChildren> {
  console.log('[ACTION] getQueryTreeNodeChildren');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { node: root as unknown as TreeNode, children: [] } as QueryTreeNodeChildren;
  }

  // AIDEV-NOTE: Tag SSR fetch by tenant/opspace so we can updateTag() after writes
  const { ok, data } = await backendFetchJSON<QueryTree>({
    path    : '/queries/tree/children',
    method  : 'GET',
    scope   : ['queries-tree:read'],
    tags    : [`tree:children:${ctx.opspacePublicId}:queries`],
    logLabel: 'getQueryTreeNodeChildren',
    context : ctx
  });

  if (!ok || !data) {
    return { node: root as unknown as TreeNode, children: [] } as QueryTreeNodeChildren;
  }

  const nid = nodeId ?? 'queries';
  return {
    node    : (data.nodes[nid as any] ?? root) as unknown as TreeNode,
    children: (data.childrenByParentId[nid as any] ?? []).map((id: string) => data.nodes[id as any] as unknown as TreeNode)
  } as QueryTreeNodeChildren;
}

// export async function getQueriesTreeNodeChildren(parentId: string): Promise<TreeNode[]> {
//   console.log('[ACTION] getQueriesTreeNodeChildren');
//   return [];

//   const hdrs = await headers();
//   // AIDEV-NOTE: Multitenancy context is provided by proxy middleware via request headers.
//   const tenantPublicId    = hdrs.get('x-tenant-id') || '';
//   const opspacePublicId   = hdrs.get('x-opspace-id') || '';
//   const operatorPublicId  = hdrs.get('x-operator-id') || '';

//   if (!tenantPublicId || !opspacePublicId || !operatorPublicId) {
//     console.error('[saveDataQuery] Missing required headers: x-tenant-id, x-opspace-id, x-operator-id');
//     return [] as ChildrenRow[];
//   }

//   const url = `${process.env.PG_QUERY_CLIENT_SERVER_URL}/queries/tree`;

//   try {
//     // AIDEV-NOTE: OBO exchange - acquire backend audience token based on validated browser JWT
//     const backendAudience = 'pg-query-client-mcp';
//     const backendJwt = await getBackendAccessTokenOnBehalfOf({
//       audience: backendAudience,
//       scope: ['queries:write'],
//       headersContext: {
//         tenantPublicId,
//         opspacePublicId,
//         operatorPublicId
//       }
//     });

//     const requestHeaders: Record<string, string> = {
//       'content-type'  : 'application/json',
//       'accept'        : 'application/json',
//       'authorization' : backendJwt ? `Bearer ${backendJwt}` : '',
//     };
//     console.log('[saveDataQuery] GET', url, 'headers:', JSON.stringify(requestHeaders));

//     const res = await fetch(url, {
//       method: 'GET',
//       headers: requestHeaders,
//       // AIDEV-NOTE: Tag SSR fetch by tenant/opspace so we can updateTag() after writes
//       next: { tags: [`tree:children:${opspacePublicId}:queries`] }
//     });

//     if (!res.ok) {
//       let body: unknown = null;
//       try {
//         body = await res.json();
//       } catch {
//         try { body = await res.text(); } catch {}
//       }
//       console.error('[getQueriesTree] Fetch failed', res.status, '-', formatError(body));
//       return { item: root, children: [] } as QueryTree;
//     }

//     // Attempt to normalize backend response into { item, children }
//     try {
//       const payload = await res.json() as BackendQueriesTreeResponse;
//       console.log('[getQueriesTree] payload', payload);
//       return { item: payload.item ?? root, children: payload.children } as QueryTree;
//     } catch {}

//     return { item: root, children: [] } as QueryTree;
//   } catch (error) {
//     console.error('[getQueriesTree] Error fetching queries tree:', formatError(error));
//     return { item: root, children: [] } as QueryTree;
//   }
// }

// export async function getQueriesTreeNode(nodeId: string): Promise<TreeNode> {
//   console.log('[ACTION] getQueriesTreeNodeChildren');

//   const hdrs = await headers();
//   // AIDEV-NOTE: Multitenancy context is provided by proxy middleware via request headers.
//   const tenantPublicId    = hdrs.get('x-tenant-id') || '';
//   const opspacePublicId   = hdrs.get('x-opspace-id') || '';
//   const operatorPublicId  = hdrs.get('x-operator-id') || '';

//   if (!tenantPublicId || !opspacePublicId || !operatorPublicId) {
//     console.error('[saveDataQuery] Missing required headers: x-tenant-id, x-opspace-id, x-operator-id');
//     return [] as ChildrenRow[];
//   }

//   const url = `${process.env.PG_QUERY_CLIENT_SERVER_URL}/queries/tree`;

//   try {
//     // AIDEV-NOTE: OBO exchange - acquire backend audience token based on validated browser JWT
//     const backendAudience = 'pg-query-client-mcp';
//     const backendJwt = await getBackendAccessTokenOnBehalfOf({
//       audience: backendAudience,
//       scope: ['queries:write'],
//       headersContext: {
//         tenantPublicId,
//         opspacePublicId,
//         operatorPublicId
//       }
//     });

//     const requestHeaders: Record<string, string> = {
//       'content-type'  : 'application/json',
//       'accept'        : 'application/json',
//       'authorization' : backendJwt ? `Bearer ${backendJwt}` : '',
//     };
//     console.log('[saveDataQuery] GET', url, 'headers:', JSON.stringify(requestHeaders));

//     const res = await fetch(url, {
//       method: 'GET',
//       headers: requestHeaders,
//       // AIDEV-NOTE: Tag SSR fetch by tenant/opspace so we can updateTag() after writes
//       next: { tags: [`tree:children:${opspacePublicId}:queries`] }
//     });

//     if (!res.ok) {
//       let body: unknown = null;
//       try {
//         body = await res.json();
//       } catch {
//         try { body = await res.text(); } catch {}
//       }
//       console.error('[getQueriesTree] Fetch failed', res.status, '-', formatError(body));
//       return { item: root, children: [] } as QueryTree;
//     }

//     // Attempt to normalize backend response into { item, children }
//     try {
//       const payload = await res.json() as BackendQueriesTreeResponse;
//       console.log('[getQueriesTree] payload', payload);
//       return { item: payload.item ?? root, children: payload.children } as QueryTree;
//     } catch {}

//     return { item: root, children: [] } as QueryTree;
//   } catch (error) {
//     console.error('[getQueriesTree] Error fetching queries tree:', formatError(error));
//     return { item: root, children: [] } as QueryTree;
//   }
// }
