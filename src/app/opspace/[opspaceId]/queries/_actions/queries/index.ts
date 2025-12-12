'use server';

import type { DataQuery }                 from '@Types/dataQuery';
import type { HeadersContext }            from '@Utils/backendFetch';
import type { ActionResult }              from '../types';
import type {
  CreateUnsavedDataQueryApiResponse,
  CreateUnsavedDataQueryResult,
  CreateNewUnsavedDataQueryPayload,
  ListDataQueriesApiResponse,
  UpdateDataQueryApiResponse,
  UpdateDataQueryPayload,
  UpdateDataQueryResult
}                                         from './types';

import { updateTag, cacheLife, cacheTag } from 'next/cache';
import { withAction }                     from '@Observability/server';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail,
  ok
}                                         from '@Errors/server/actionResult.server';
import {
  backendFetchJSON,
}                                         from '@Utils/backendFetch';
import {
  queriesListTag,
  queryTreeChildrenTag,
  queryTreeInitialTag,
  tabsOpenListTag,
  unsavedQueryTreeInitialTag
}                                         from '../tags';


// Cached list of queries per HeadersContext using "use cache".
// Cache is scoped by tenant/opspace/operator via HeadersContext and invalidated by updateTag('queries:list:...').
type ListDataQueriesCachedResult =
  | { ok: true; data: DataQuery[] }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function listDataQueriesCached(ctx: HeadersContext): Promise<ListDataQueriesCachedResult> {
  'use cache';

  cacheLife({
    // AIDEV-NOTE: This cache may be reused for up to 60 seconds before recomputing in the background.
    revalidate: 60, // 1 minute
    expire    : 300 // 5 minutes
  });
  cacheTag(queriesListTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<ListDataQueriesApiResponse>({
    path    : '/queries',
    method  : 'GET',
    scope   : ['queries:read'],
    logLabel: 'listDataQueriesAction',
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

export async function listDataQueriesAction(): Promise<ActionResult<DataQuery[]>> {
  return withAction(
    { action: 'queries.list', op: 'read' },
    async ({ ctx, meta }) => {
      const data = await listDataQueriesCached(ctx);
      if (!data.ok) {
        if (data.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to list queries.',
            request: { path: '/queries', method: 'GET', scope: ['queries:read'], logLabel: 'listDataQueriesAction' }
          }));
        }
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status: data.status,
          fallbackMessage: 'Failed to list queries.',
          request: { path: '/queries', method: 'GET', scope: ['queries:read'], logLabel: 'listDataQueriesAction' }
        }));
      }

      return ok(meta, data.data);
    }
  );
}

export async function createNewUnsavedDataQueryAction(payload: CreateNewUnsavedDataQueryPayload): Promise<ActionResult<CreateUnsavedDataQueryResult>> {
  const { dataQueryId, name } = payload;
  return withAction(
    {
      action : 'queries.createUnsaved',
      op     : 'write',
      input  : {
        dataQueryId,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    },
    async ({ ctx, meta }) => {
      const body = name
        ? { dataQueryId, name }
        : { dataQueryId };

      const res = await backendFetchJSON<CreateUnsavedDataQueryApiResponse>({
        path    : `/queries/unsaved`,
        method  : 'POST',
        scope   : ['queries-unsaved:write'],
        logLabel: 'createNewUnsavedDataQuery',
        context : ctx,
        body
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to create a new unsaved query.',
          request         : { path: '/queries/unsaved', method: 'POST', scope: ['queries-unsaved:write'], logLabel: 'createNewUnsavedDataQuery' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to create a new unsaved query.',
          request: { path: '/queries/unsaved', method: 'POST', scope: ['queries-unsaved:write'], logLabel: 'createNewUnsavedDataQuery' }
        }));
      }

      // AIDEV-NOTE: Invalidate cached QUERIES children on successful save
      try {
        updateTag(unsavedQueryTreeInitialTag(ctx.opspacePublicId));
      } catch {}

      // AIDEV-NOTE: Invalidate cached listDataQueries results for this opspace.
      try {
        updateTag(queriesListTag(ctx.opspacePublicId));
      } catch {}

      try {
        updateTag(tabsOpenListTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, res.data.data);
    }
  );
}

export async function updateDataQueryAction(payload: UpdateDataQueryPayload): Promise<ActionResult<UpdateDataQueryResult>> {
  const { dataQueryId, name, queryText } = payload;
  return withAction(
    {
      action : 'queries.update',
      op     : 'write',
      input  : {
        dataQueryId,
        nameLen: typeof name === 'string' ? name.length : undefined,
        queryTextLen: typeof queryText === 'string' ? queryText.length : undefined
      }
    },
    async ({ ctx, meta }) => {
      const res = await backendFetchJSON<UpdateDataQueryApiResponse>({
        path    : `/queries/${dataQueryId}`,
        method  : 'PATCH',
        scope   : ['queries:write'],
        body    : { name, queryText },
        logLabel: 'updateDataQueryAction',
        context : ctx
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to save query.',
          request         : { path: `/queries/${dataQueryId}`, method: 'PATCH', scope: ['queries:write'], logLabel: 'updateDataQueryAction' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to save query.',
          request: { path: `/queries/${dataQueryId}`, method: 'PATCH', scope: ['queries:write'], logLabel: 'updateDataQueryAction' }
        }));
      }

      if (name !== undefined) {
        // AIDEV-NOTE: Invalidate cached QUERIES children on successful save if name changed
        try {
          updateTag(queryTreeInitialTag(ctx.opspacePublicId));
        } catch {}

        // AIDEV-NOTE: Invalidate cached "tree node children" reads (QueryWorkspace tree browser).
        try {
          updateTag(queryTreeChildrenTag(ctx.opspacePublicId));
        } catch {}

        // AIDEV-NOTE: Invalidate cached unsaved query tree on successful save (only if name changed)
        try {
          updateTag(unsavedQueryTreeInitialTag(ctx.opspacePublicId));
        } catch {}
      }

      // AIDEV-NOTE: Invalidate cached listDataQueries results for this opspace.
      try {
        updateTag(queriesListTag(ctx.opspacePublicId));
      } catch {}

      return ok(meta, res.data.data);
    }
  );
}
