'use server';

import type { UUIDv7 }                    from '@Types/primitives';
import type { Tab, Tabbar }               from '@Types/tabs';
import type { HeadersContext }            from '@Utils/backendFetch';
import type { ActionResult }              from '../types';
import type {
  ListOpenTabsApiResponse,
  OpenTabApiResponse,
  ReorderTabs,
  ReorderTabsApiResponse
}                                         from './types';

import { cacheLife, cacheTag, updateTag } from 'next/cache';
import { withAction }                     from '@Observability/server/action';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail, ok
}                                         from '@Errors/server/actionResult.server';
import { backendFetchJSON }               from '@Utils/backendFetch';
import {
  tabsOpenListTag,
  unsavedQueryTreeInitialTag
}                                         from '../tags';


type ListOpenTabsCachedResult =
  | { ok: true; data: Tabbar }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function listOpenTabsCached(ctx: HeadersContext): Promise<ListOpenTabsCachedResult> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60,     // 1 minute
    expire    : 300     // 5 minutes
  });
  cacheTag(tabsOpenListTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<ListOpenTabsApiResponse>({
    path: '/tabs/open',
    method: 'GET',
    scope: ['tabs-open:read'],
    logLabel: 'listOpenTabsAction',
    context: ctx
  });

  if (!res.ok) {
    return { ok: false, status: res.status, reason: 'fetch-failed' };
  }

  if (!res.data?.ok) {
    return { ok: false, status: res.status, reason: 'backend-ok-false' };
  }

  return { ok: true, data: res.data.data };
}

export async function listOpenTabsAction(): Promise<ActionResult<Tabbar>> {
  return withAction(
    { action: 'tabs.listOpen', op: 'read' },
    async ({ ctx, meta }) => {
      const data = await listOpenTabsCached(ctx);
      if (!data.ok) {
        if (data.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to list open tabs.',
            request: { path: '/tabs/open', method: 'GET', scope: ['tabs-open:read'], logLabel: 'listOpenTabsAction' }
          }));
        }
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: data.status,
          fallbackMessage: 'Failed to list open tabs.',
          request: { path: '/tabs/open', method: 'GET', scope: ['tabs-open:read'], logLabel: 'listOpenTabsAction' }
        }));
      }

      return ok(meta, data.data);
    }
  );
}

export async function setActiveTabAction(tabId: UUIDv7): Promise<ActionResult<void>> {
  return withAction(
    {
      action : 'tabs.setActive',
      op     : 'write',
      input  : { tabId }
    },
    async ({ ctx, meta }) => {
      const res = await backendFetchJSON({
        path: `/tabs/${tabId}/focus`,
        method: 'POST',
        contentType: null,
        scope: ['tabs-focus:write'],
        logLabel: 'setActiveTab',
        context: ctx
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: res.status,
          error: res.error,
          fallbackMessage: 'Failed to set active tab.',
          request: { path: `/tabs/${tabId}/focus`, method: 'POST', scope: ['tabs-focus:write'], logLabel: 'setActiveTab' }
        }));
      }

      // AIDEV-NOTE: We intentionally do NOT invalidate the tabs-open:list cache here.
      // Focus changes only activeTabId/focusedTabIndex, which the client already
      // tracks in Redux. Cache busting is reserved for structural changes (open/close/reorder).

      return ok(meta, undefined);
    }
  );
}

export async function closeTabAction(tabId: UUIDv7): Promise<ActionResult<void>> {
  return withAction(
    {
      action : 'tabs.close',
      op     : 'write',
      input  : { tabId }
    },
    async ({ ctx, meta }) => {
      const res = await backendFetchJSON({
        path        : `/tabs/${tabId}/close`,
        method      : 'POST',
        contentType : null,
        scope       : ['tabs-close:write'],
        logLabel    : 'closeTab',
        context     : ctx
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: res.status,
          error: res.error,
          fallbackMessage: 'Failed to close tab.',
          request: { path: `/tabs/${tabId}/close`, method: 'POST', scope: ['tabs-close:write'], logLabel: 'closeTab' }
        }));
      }

      // AIDEV-NOTE: Invalidate cached unsaved query tree on successful close
      try {
        updateTag(unsavedQueryTreeInitialTag(ctx.opspacePublicId));
      } catch {}

      // AIDEV-NOTE: Invalidate cached list of open tabs on successful close
      try {
        updateTag(tabsOpenListTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, undefined);
    }
  );
}

export async function openTabAction(mountId: UUIDv7): Promise<ActionResult<Tab>> {
  return withAction(
    {
      action : 'tabs.open',
      op     : 'write',
      input  : { mountId }
    },
    async ({ ctx, meta }) => {
      // It is assumed that the mountId is the dataQueryId
      // Will need to update this later to accept other mount types
      const res = await backendFetchJSON<OpenTabApiResponse>({
        path: `/tabs/open`,
        method: 'POST',
        scope: ['tabs-open:write'],
        logLabel: 'openTab',
        context: ctx,
        body: { dataQueryId: mountId }
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: res.status,
          error: res.error,
          fallbackMessage: 'Failed to open tab.',
          request: { path: '/tabs/open', method: 'POST', scope: ['tabs-open:write'], logLabel: 'openTab' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to open tab.',
          request: { path: '/tabs/open', method: 'POST', scope: ['tabs-open:write'], logLabel: 'openTab' }
        }));
      }

      // Invalidate cached list of open tabs
      try {
        updateTag(tabsOpenListTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, res.data.data);
    }
  );
}

export async function reorderTabAction(tabId: UUIDv7, newPosition: number, tabGroup?: number): Promise<ActionResult<ReorderTabs>> {
  return withAction(
    {
      action : 'tabs.reorder',
      op     : 'write',
      input  : { tabId, newPosition, tabGroup }
    },
    async ({ ctx, meta }) => {
      const res = await backendFetchJSON<ReorderTabsApiResponse>({
        path: `/tabs/${tabId}/reorder`,
        method: 'POST',
        scope: ['tabs-reorder:write'],
        logLabel: 'reorderTab',
        context: ctx,
        body: { tabId, newPosition }
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: res.status,
          error: res.error,
          fallbackMessage: 'Failed to reorder tabs.',
          request: { path: `/tabs/${tabId}/reorder`, method: 'POST', scope: ['tabs-reorder:write'], logLabel: 'reorderTab' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to reorder tabs.',
          request: { path: `/tabs/${tabId}/reorder`, method: 'POST', scope: ['tabs-reorder:write'], logLabel: 'reorderTab' }
        }));
      }

      // AIDEV-NOTE: Reordering changes the logical "open tabs" resource (positions),
      // so invalidate the cached list just like open/close/focus do.
      try {
        updateTag(tabsOpenListTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, res.data.data);
    }
  );
}
