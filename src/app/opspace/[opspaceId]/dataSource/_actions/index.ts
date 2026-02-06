'use server';

import type { HeadersContext }            from '@Utils/backendFetch';
import type { ActionMeta }                from '@Errors/types';
import type { ActionResult }              from '@Errors/types';
import type { FieldError }                from '@Errors/fieldError';
import type {
  DataSourceMeta,
  DataSourceRecord
}                                         from '@Redux/records/dataSource/types';
import type { UUIDv7 }                    from '@Types/primitives';
import type {
  DataSource,
  PostgresDataSourceTestPayload
}                                         from '@Types/dataSource';
import type {
  CreateDataSourceApiResponse,
  DataSourceTestResult,
  DeleteDataSourceApiResponse,
  ListDataSourceApiResponse,
  TestDataSourceApiResponse
}                                         from './types';

import { cacheLife, cacheTag, updateTag } from 'next/cache';
import { withAction }                     from '@Observability/server/action';
import {
  validateDataSourceCreatePayload,
  validatePostgresDataSourceTestPayload
}                                         from '@Redux/records/dataSource/validation';
import {
  actionErrorFromBackendFetch,
  backendFailedActionError,
  fail,
  ok
}                                         from '@Errors/server/actionResult.server';
import { ERROR_CODES }                    from '@Errors/codes';
import { backendFetchJSON }               from '@Utils/backendFetch';
import { tabsOpenListTag }                from '../../queries/_actions/tags';
import { dataSourcesListTag }             from './tags';


type TestInputSummary = {
  nameLen?      : number;
  sslMode?      : string;
  hostLen?      : number;
  port?         : number;
  userLen?      : number;
  passwordLen?  : number;
  dbLen?        : number;
};

function summarizeTestInput(payload: PostgresDataSourceTestPayload): TestInputSummary {
  return {
    nameLen     : typeof payload.name     === 'string' ? payload.name.length     : undefined,
    sslMode     : typeof payload.sslMode  === 'string' ? payload.sslMode         : undefined,
    hostLen     : typeof payload.host     === 'string' ? payload.host.length     : undefined,
    port        : typeof payload.port     === 'number' ? payload.port            : undefined,
    userLen     : typeof payload.username === 'string' ? payload.username.length : undefined,
    passwordLen : typeof payload.password === 'string' ? payload.password.length : undefined,
    dbLen       : typeof payload.database === 'string' ? payload.database.length : undefined
  };
}

type CreateInputSummary = {
  kind?           : string;
  nameLen?        : number;
  descriptionLen? : number;
  targetLabelLen? : number;
  sslMode?        : string;
  persistSecret?  : boolean;
  hostLen?        : number;
  port?           : number;
  userLen?        : number;
  passwordLen?    : number;
  dbLen?          : number;
  locationLen?    : number;
};

function summarizeCreateInput(payload: DataSource): CreateInputSummary {
  if (payload.kind === 'postgres') {
    return {
      kind            : payload.kind,
      nameLen         : typeof payload.name          === 'string'  ? payload.name.length        : undefined,
      descriptionLen  : typeof payload.description   === 'string'  ? payload.description.length : undefined,
      targetLabelLen  : typeof payload.targetLabel   === 'string'  ? payload.targetLabel.length : undefined,
      sslMode         : typeof payload.sslMode       === 'string'  ? payload.sslMode            : undefined,
      persistSecret   : typeof payload.persistSecret === 'boolean' ? payload.persistSecret      : undefined,
      hostLen         : typeof payload.host          === 'string'  ? payload.host.length        : undefined,
      port            : typeof payload.port          === 'number'  ? payload.port               : undefined,
      userLen         : typeof payload.username      === 'string'  ? payload.username.length    : undefined,
      passwordLen     : typeof payload.password      === 'string'  ? payload.password.length    : undefined,
      dbLen           : typeof payload.database      === 'string'  ? payload.database.length    : undefined
    };
  }

  return {
    kind            : payload.kind,
    nameLen         : typeof payload.name        === 'string' ? payload.name.length        : undefined,
    descriptionLen  : typeof payload.description === 'string' ? payload.description.length : undefined,
    targetLabelLen  : typeof payload.targetLabel === 'string' ? payload.targetLabel.length : undefined,
    locationLen     : typeof payload.location    === 'string' ? payload.location.length    : undefined,
    dbLen           : typeof payload.database    === 'string' ? payload.database.length    : undefined,
    userLen         : typeof payload.username    === 'string' ? payload.username.length    : undefined
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
  | { ok: true; data: DataSourceRecord }
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

export async function listDataSourcesAction(): Promise<ActionResult<DataSourceRecord>> {
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

export async function testDataSourceAction(payload: PostgresDataSourceTestPayload): Promise<ActionResult<DataSourceTestResult>> {
  const summary = summarizeTestInput(payload);
  return withAction(
    {
      action : 'dataSource.test',
      op     : 'write',
      input  : summary
    },
    async ({ ctx, meta }) => {
      const validated = validatePostgresDataSourceTestPayload(payload);
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

export async function createDataSourceAction(payload: DataSource): Promise<ActionResult<DataSourceMeta>> {
  const summary = summarizeCreateInput(payload);
  return withAction(
    {
      action : 'dataSource.create',
      op     : 'write',
      input  : summary
    },
    async ({ ctx, meta }) => {
      const validated = validateDataSourceCreatePayload(payload);
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

      try { updateTag(dataSourcesListTag(ctx.opspacePublicId)); } catch {}

      return ok(meta, res.data.data);
    }
  );
}

export async function deleteDataSourceAction(dataSourceId: UUIDv7): Promise<ActionResult<void>> {
  return withAction(
    {
      action : 'dataSource.delete',
      op     : 'write',
      input  : { dataSourceId }
    },
    async ({ ctx, meta }) => {
      const path = `/data-sources/${dataSourceId}`;

      const backendResult = await backendFetchJSON<DeleteDataSourceApiResponse>({
        path        : path,
        method      : 'DELETE',
        contentType : null,
        scope       : ['data-sources:delete'],
        logLabel    : 'deleteDataSourceAction',
        context     : ctx
      });

      if (!backendResult.ok) {
        return fail(meta, actionErrorFromBackendFetch(meta, {
          status          : backendResult.status,
          error           : backendResult.error,
          fallbackMessage : 'Failed to delete data source.',
          request         : { path, method: 'DELETE', scope: ['data-sources:delete'], logLabel: 'deleteDataSourceAction' }
        }));
      }

      if (!backendResult.data?.ok) {
        return fail(meta, backendFailedActionError(meta, {
          message: 'Failed to delete data source.',
          request: { path, method: 'DELETE', scope: ['data-sources:delete'], logLabel: 'deleteDataSourceAction' }
        }));
      }

      try { updateTag(dataSourcesListTag(ctx.opspacePublicId)); } catch {}
      try { updateTag(tabsOpenListTag(ctx.opspacePublicId)); } catch {}

      return ok(meta, undefined);
    }
  );
}
