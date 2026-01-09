'use server';

import type { HeadersContext }                  from '@Utils/backendFetch';
import type { ActionMeta }                      from '@Errors/types';
import type { ActionResult }                    from '@Errors/types';
import type { FieldError }                      from '@Errors/fieldError';
import type { UUIDv7 }                          from '@Types/primitives';
import type { DataSourceDraft, DataSourceMeta } from '@Redux/records/dataSource/types';
import type {
  CreateDataSourceApiResponse,
DataSourceTestResult,
  GetActiveDataSourceApiResponse,
  ListDataSourceApiResponse,
  TestDataSourceApiResponse
}                                               from './types';

import { cacheLife, cacheTag, updateTag }       from 'next/cache';
import { withAction }                           from '@Observability/server/action';
import { validateDataSourceDraft }              from '@Redux/records/dataSource/validation';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail,
  ok
}                                               from '@Errors/server/actionResult.server';
import { ERROR_CODES }                          from '@Errors/codes';
import { backendFetchJSON }                     from '@Utils/backendFetch';
import {
  dataSourcesActiveTag,
  dataSourcesListTag
}                                               from './tags';


type InputSummary = {
  serverGroupNameLen? : number;
  sslMode?            : string;
  persistSecret?      : boolean;
  hasUri?             : boolean;
  uriLen?             : number;
  hostLen?            : number;
  userLen?            : number;
  passwordLen?        : number;
  dbLen?              : number;
};

function summarizeDraftInput(draft: DataSourceDraft): InputSummary {
  return {
    serverGroupNameLen : typeof draft.serverGroupName === 'string' ? draft.serverGroupName.length : undefined,
    sslMode            : typeof draft.sslMode === 'string' ? draft.sslMode : undefined,
    persistSecret      : typeof draft.persistSecret === 'boolean' ? draft.persistSecret : undefined,
    hasUri             : typeof draft.dataSourceUri === 'string' && draft.dataSourceUri.length > 0,
    uriLen             : typeof draft.dataSourceUri === 'string' ? draft.dataSourceUri.length : undefined,
    hostLen            : typeof draft.host === 'string' ? draft.host.length : undefined,
    userLen            : typeof draft.username === 'string' ? draft.username.length : undefined,
    passwordLen        : typeof draft.password === 'string' ? draft.password.length : undefined,
    dbLen              : typeof draft.database === 'string' ? draft.database.length : undefined
  };
}

function invalidInputResult<T>(meta: ActionMeta, errors: FieldError[]): ActionResult<T> {
  return fail(meta, {
    id        : meta.requestId,
    kind      : 'validation',
    code      : ERROR_CODES.input.invalidInput,
    message   : 'Some fields are invalid.',
    status    : 422,
    retryable : false,
    fields    : errors
  });
}

// Cached list per HeadersContext using "use cache".
type ListDataSourcesCachedResult =
  | { ok: true; data: DataSourceMeta[] }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function listDataSourcesCached(ctx: HeadersContext): Promise<ListDataSourcesCachedResult> {
  'use cache';

  cacheLife({
    revalidate: 60,
    expire    : 300
  });
  cacheTag(dataSourcesListTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<ListDataSourceApiResponse>({
    path      : '/data-sources',
    method    : 'GET',
    scope     : ['data-sources:read'],
    logLabel  : 'listDataSourcesAction',
    context   : ctx
  });

  if (!res.ok) {
    return { ok: false, status: res.status, reason: 'fetch-failed' };
  }

  if (!res.data?.ok) {
    return { ok: false, status: res.status, reason: 'backend-ok-false' };
  }

  return { ok: true, data: res.data.data };
}

export async function listDataSourcesAction(): Promise<ActionResult<DataSourceMeta[]>> {
  return withAction(
    { action: 'dataSource.list', op: 'read' },
    async ({ ctx, meta }) => {
      const data = await listDataSourcesCached(ctx);
      if (!data.ok) {
        if (data.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to list data sources.',
            request: { path: '/data-sources', method: 'GET', scope: ['data-sources:read'], logLabel: 'listDataSourcesAction' }
          }));
        }
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : data.status,
          fallbackMessage : 'Failed to list data sources.',
          request         : { path: '/data-sources', method: 'GET', scope: ['data-sources:read'], logLabel: 'listDataSourcesAction' }
        }));
      }

      return ok(meta, data.data);
    }
  );
}

// Cached active connection per HeadersContext.
type GetActiveCachedResult =
  | { ok: true; data: { dataSourceId: UUIDv7 | null } }
  | { ok: false; status: number; reason: 'fetch-failed' | 'backend-ok-false' };

async function getActiveDataSourceCached(ctx: HeadersContext): Promise<GetActiveCachedResult> {
  'use cache';

  cacheLife({
    revalidate: 15,
    expire    : 120
  });
  cacheTag(dataSourcesActiveTag(ctx.opspacePublicId));

  const res = await backendFetchJSON<GetActiveDataSourceApiResponse>({
    path      : '/data-sources/active',
    method    : 'GET',
    scope     : ['data-sources:read'],
    logLabel  : 'getActiveDataSourceAction',
    context   : ctx
  });

  if (!res.ok) {
    return { ok: false, status: res.status, reason: 'fetch-failed' };
  }

  if (!res.data?.ok) {
    return { ok: false, status: res.status, reason: 'backend-ok-false' };
  }

  return { ok: true, data: res.data.data };
}

export async function getActiveDataSourceAction(): Promise<ActionResult<{ dataSourceId: UUIDv7 | null }>> {
  return withAction(
    { action: 'dataSource.getActive', op: 'read' },
    async ({ ctx, meta }) => {
      const data = await getActiveDataSourceCached(ctx);
      if (!data.ok) {
        if (data.reason === 'backend-ok-false') {
          return fail(meta, backendFailedActionError(meta, {
            message: 'Failed to load active connection.',
            request: { path: '/data-sources/active', method: 'GET', scope: ['data-sources:read'], logLabel: 'getActiveDataSourceAction' }
          }));
        }
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : data.status,
          fallbackMessage : 'Failed to load active connection.',
          request         : { path: '/data-sources/active', method: 'GET', scope: ['data-sources:read'], logLabel: 'getActiveDataSourceAction' }
        }));
      }

      return ok(meta, data.data);
    }
  );
}

export async function testDataSourceAction(payload: DataSourceDraft): Promise<ActionResult<DataSourceTestResult>> {
  const summary = summarizeDraftInput(payload);
  return withAction(
    {
      action : 'dataSource.test',
      op     : 'write',
      input  : summary
    },
    async ({ ctx, meta }) => {
      const validated = validateDataSourceDraft(payload);
      if (!validated.ok) {
        return invalidInputResult(meta, validated.errors);
      }

      const res = await backendFetchJSON<TestDataSourceApiResponse>({
        path      : '/data-sources/test',
        method    : 'POST',
        scope     : ['data-sources:test'],
        logLabel  : 'testDataSourceAction',
        context   : ctx,
        body      : payload
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to test connection.',
          request         : { path: '/data-sources/test', method: 'POST', scope: ['data-sources:test'], logLabel: 'testDataSourceAction' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to test connection.',
          request: { path: '/data-sources/test', method: 'POST', scope: ['data-sources:test'], logLabel: 'testDataSourceAction' }
        }));
      }

      return ok(meta, res.data.data);
    }
  );
}

export async function createDataSourceAction(payload: DataSourceDraft): Promise<ActionResult<DataSourceMeta>> {
  const summary = summarizeDraftInput(payload);
  return withAction(
    {
      action : 'dataSource.create',
      op     : 'write',
      input  : summary
    },
    async ({ ctx, meta }) => {
      const validated = validateDataSourceDraft(payload);
      if (!validated.ok) {
        return invalidInputResult(meta, validated.errors);
      }

      const res = await backendFetchJSON<CreateDataSourceApiResponse>({
        path      : '/data-sources',
        method    : 'POST',
        scope     : ['data-sources:write'],
        logLabel  : 'createDataSourceAction',
        context   : ctx,
        body      : payload
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to create connection.',
          request         : { path: '/data-sources', method: 'POST', scope: ['data-sources:write'], logLabel: 'createDataSourceAction' }
        }));
      }

      if (!res.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to create connection.',
          request: { path: '/data-sources', method: 'POST', scope: ['data-sources:write'], logLabel: 'createDataSourceAction' }
        }));
      }

      // AIDEV-NOTE: Creating a connection mutates both the list and (often) the active pointer.
      try { updateTag(dataSourcesListTag(ctx.opspacePublicId)); } catch {}
      try { updateTag(dataSourcesActiveTag(ctx.opspacePublicId)); } catch {}

      return ok(meta, res.data.data);
    }
  );
}

export async function setActiveDataSourceAction(dataSourceId: UUIDv7): Promise<ActionResult<void>> {
  return withAction(
    {
      action : 'dataSource.setActive',
      op     : 'write',
      input  : { dataSourceId }
    },
    async ({ ctx, meta }) => {
      const res = await backendFetchJSON({
        path        : `/data-sources/${dataSourceId}/active`,
        method      : 'POST',
        contentType : null,
        scope       : ['data-sources:write'],
        logLabel    : 'setActiveDataSourceAction',
        context     : ctx
      });

      if (!res.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : res.status,
          error           : res.error,
          fallbackMessage : 'Failed to set active connection.',
          request         : { path: `/data-sources/${dataSourceId}/active`, method: 'POST', scope: ['data-sources:write'], logLabel: 'setActiveDataSourceAction' }
        }));
      }

      // AIDEV-NOTE: Invalidate cached active pointer reads.
      try { updateTag(dataSourcesActiveTag(ctx.opspacePublicId)); } catch {}

      return ok(meta, undefined);
    }
  );
}
