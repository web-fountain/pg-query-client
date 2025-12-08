'use server';

import type { DataQuery }                 from '@Types/dataQuery';
import type { Extension, UUIDv7 }         from '@Types/primitives';
import type { UnsavedQueryTreeNode }      from '@Types/unsavedQueryTree';
import type { HeadersContext }            from '@Utils/backendFetch';

import { updateTag, cacheLife, cacheTag } from 'next/cache';

import {
  backendFetchJSON,
  getHeadersContextOrNull
}                                         from '@Utils/backendFetch';
import { UpdateDataQuery } from '@/redux/records/dataQuery/types';


type ResponsePayload04 = {
  ok: true;
  data: DataQuery[];
};
// AIDEV-NOTE: Cached list of queries per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('queries:list:...').
async function listDataQueriesCached(ctx: HeadersContext): Promise<DataQuery[] | null> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });
  cacheTag(`queries:list:${ctx.opspacePublicId}`);

  console.log('[ACTION] listDataQueries');

  const { ok, data } = await backendFetchJSON<ResponsePayload04>({
    path    : '/queries',
    method  : 'GET',
    scope   : ['queries:read'],
    logLabel: 'listDataQueries',
    context : ctx
  });

  if (!ok || !data?.ok) {
    return null;
  }

  return data.data;
}

export async function listDataQueries() : Promise<{ success: boolean; data?: DataQuery[] }> {
  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const data = await listDataQueriesCached(ctx);
  if (!data) {
    return { success: false };
  }

  return { success: true, data };
}

type FetchData = {
  dataQueryId : UUIDv7;
  name        : string;
  ext         : Extension;
  tab: {
    groupId   : number;
    tabId     : UUIDv7;
    mountId   : UUIDv7;
    position  : number;
  },
  tree: UnsavedQueryTreeNode
};
type ResponsePayload03 =
  | { ok: false }
  | { ok: true; data: FetchData };
export async function createNewUnsavedDataQueryAction(payload: { dataQueryId: UUIDv7, name?: string }): Promise<{ success: boolean; data?: FetchData }> {
  console.log('[ACTION] createNewUnsavedDataQuery');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const { dataQueryId, name } = payload;
  const body = name
    ? { dataQueryId, name }
    : { dataQueryId };

  console.log('[ACTION] createNewUnsavedDataQuery body', body);

  const { ok, data } = await backendFetchJSON<ResponsePayload03>({
    path    : `/queries/unsaved`,
    method  : 'POST',
    scope   : ['queries-unsaved:write'],
    logLabel: 'createNewUnsavedDataQuery',
    context : ctx,
    body
  });

  console.log('[ACTION] createNewUnsavedDataQuery response', { data });

  if (!ok || !data?.ok) {
    return { success: false };
  }

  // AIDEV-NOTE: Invalidate cached QUERIES children on successful save
  try {
    updateTag(`tree:children:${ctx.opspacePublicId}:buildInitialUnsavedQueryTree`);
  } catch {}

  // AIDEV-NOTE: Invalidate cached listDataQueries results for this opspace.
  try {
    updateTag(`queries:list:${ctx.opspacePublicId}`);
  } catch {}

  try {
    updateTag(`tabs-open:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true, data: data.data };
}

type ResponsePayload05 = {
  ok: false | true;
};
export async function updateDataQuery(payload: { dataQueryId: UUIDv7, name?: string, queryText?: string }): Promise<{ success: boolean }> {
  console.log('[ACTION] updateDataQuery');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const { dataQueryId, name, queryText } = payload;

  const { ok } = await backendFetchJSON<ResponsePayload05>({
    path    : `/queries/${dataQueryId}`,
    method  : 'PATCH',
    scope   : ['queries:write'],
    body    : { name, queryText },
    logLabel: 'updateDataQuery',
    context : ctx
  });

  if (!ok) {
    return { success: false };
  }

  if (name !== undefined) {
    // AIDEV-NOTE: Invalidate cached QUERIES children on successful save if name changed
    try {
      updateTag(`tree:children:${ctx.opspacePublicId}:buildInitialQueryTree`);
    } catch {}

    // AIDEV-NOTE: Invalidate cached unsaved query tree on successful save (only if name changed)
    try {
      updateTag(`tree:children:${ctx.opspacePublicId}:buildInitialUnsavedQueryTree`);
    } catch {}
  }

   // AIDEV-NOTE: Invalidate cached listDataQueries results for this opspace.
  try {
    updateTag(`queries:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true };
}
