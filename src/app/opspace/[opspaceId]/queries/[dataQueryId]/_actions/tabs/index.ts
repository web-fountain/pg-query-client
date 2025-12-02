'use server';

import type { UUIDv7 }          from '@Types/primitives';
import type { Tab, Tabbar }     from '@Types/tabs';
import type { HeadersContext }  from '@Utils/backendFetch';

import { cacheLife, cacheTag, updateTag }  from 'next/cache';
import {
  backendFetchJSON,
  getHeadersContextOrNull
}                               from '@Utils/backendFetch';


type ResponsePayload05 = {
  ok: true;
  data: Tabbar;
};
async function listOpenTabsCached(ctx: HeadersContext): Promise<Tabbar | null> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60,     // 1 minute
    expire    : 300     // 5 minutes
  });

  cacheTag(`tabs-open:list:${ctx.opspacePublicId}`);

  const { ok, data } = await backendFetchJSON<ResponsePayload05>({
    path: '/tabs/open',
    method: 'GET',
    scope: ['tabs-open:read'],
    logLabel: 'listOpenTabs',
    context: ctx
  });

  if (!ok || !data?.ok) {
    return null;
  }

  return data.data;
}

export async function listOpenTabs() : Promise<{ success: boolean; data?: Tabbar }> {
  console.log('[ACTION] listOpenTabs');

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const data = await listOpenTabsCached(ctx);
  if (!data) {
    return { success: false };
  }

  return { success: true, data };
}

export async function setActiveTabAction(tabId: UUIDv7): Promise<{ success: boolean; }> {
  console.log('[ACTION] setActiveTab', tabId);

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const { ok } = await backendFetchJSON({
    path: `/tabs/${tabId}/focus`,
    method: 'POST',
    contentType: null,
    scope: ['tabs-focus:write'],
    logLabel: 'setActiveTab',
    context: ctx
  });

  if (!ok) {
    return { success: false };
  }

  // AIDEV-NOTE: Invalidate cached list of open tabs on successful focus
  try {
    updateTag(`tabs-open:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true };
}

export async function closeTabAction(tabId: UUIDv7): Promise<{ success: boolean; }> {
  console.log('[ACTION] closeTab', tabId);

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const { ok } = await backendFetchJSON({
    path: `/tabs/${tabId}/close`,
    method: 'POST',
    contentType: null,
    scope: ['tabs-close:write'],
    logLabel: 'closeTab',
    context: ctx
  });

  if (!ok) {
    return { success: false };
  }

  // AIDEV-NOTE: Invalidate cached unsaved query tree on successful close
  try {
    updateTag(`tree:children:${ctx.opspacePublicId}:buildInitialUnsavedQueryTree`);
  } catch {}

  // AIDEV-NOTE: Invalidate cached list of open tabs on successful close
  try {
    updateTag(`tabs-open:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true };
}

type OpenTabResponse =
  | { ok: false }
  | { ok: true; data: Tab };
export async function openTabAction(mountId: UUIDv7): Promise<{ success: boolean; data?: Tab }> {
  console.log('[ACTION] openSavedQueryTab', mountId);

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  // It is assumed that the mountId is the dataQueryId
  // Will need to update this later to accept other mount types
  const { ok, data } = await backendFetchJSON<OpenTabResponse>({
    path: `/tabs/open`,
    method: 'POST',
    scope: ['tabs-open:write'],
    logLabel: 'openTab',
    context: ctx,
    body: { dataQueryId: mountId }
  });

  if (!ok || !data?.ok) {
    return { success: false };
  }

  // Invalidate cached list of open tabs
  try {
    updateTag(`tabs-open:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true, data: data.data };
}

type ReorderTabsResponse =
  | { ok: false }
  | { ok: true; data: { from: number; to: number; } };
export async function reorderTabAction(tabId: UUIDv7, newPosition: number, tabGroup?: number): Promise<{ success: boolean; data?: { from: number; to: number; } }> {
  console.log('[ACTION] reorderTab', tabId, newPosition, tabGroup);

  const ctx = await getHeadersContextOrNull();
  if (!ctx) {
    return { success: false };
  }

  const { ok, data } = await backendFetchJSON<ReorderTabsResponse>({
    path: `/tabs/${tabId}/reorder`,
    method: 'POST',
    scope: ['tabs-reorder:write'],
    logLabel: 'reorderTab',
    context: ctx,
    body: { tabId, newPosition }
  });

  if (!ok || !data?.ok) {
    return { success: false };
  }

  // AIDEV-NOTE: Reordering changes the logical "open tabs" resource (positions),
  // so invalidate the cached list just like open/close/focus do.
  try {
    updateTag(`tabs-open:list:${ctx.opspacePublicId}`);
  } catch {}

  return { success: true, data: data.data };
}
