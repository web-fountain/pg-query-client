import type { RootState }                     from '@Redux/store';
import type { UUIDv7 }                        from '@Types/primitives';

import { createAsyncThunk }                   from '@reduxjs/toolkit';

import { logAudit }                           from '@Observability/client/audit';
import { generateUUIDv7 }                     from '@Utils/generateId';
import { upsertDataQueryExecution }           from '@Redux/records/dataQueryExecution';

import { postQueryExecution }                 from './api';
import { normalizeQueryExecutionApiPayload }  from './normalize';


export const executeDataQueryThunk = createAsyncThunk<void, { dataQueryId: UUIDv7; dataSourceCredentialId: UUIDv7; queryText: string }, { state: RootState }>(
  'dataQueryExecution/executeDataQueryThunk',
  async ({ dataQueryId, dataSourceCredentialId, queryText }, { dispatch }) => {
    // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
    const rawQueryText = queryText;
    if ((rawQueryText || '').trim().length === 0) return;

    // AIDEV-TODO: Add cancellation semantics (AbortController + backend cancel endpoint) once supported.
    const dataQueryExecutionId = generateUUIDv7();
    const startedAtClient = new Date().toISOString();

    dispatch(upsertDataQueryExecution({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : dataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      status                  : 'running',
      queryTextLen            : rawQueryText.length,
      startedAt               : startedAtClient
    }));

    // AIDEV-NOTE: Fire-and-forget audit event for correlation/compliance; never include raw SQL.
    try {
      logAudit({ event: 'query:execute', dataQueryId });
    } catch {}

    const postResult = await postQueryExecution({
      dataQueryId             : dataQueryId,
      dataQueryExecutionId    : dataQueryExecutionId,
      dataSourceCredentialId  : dataSourceCredentialId,
      queryText               : rawQueryText
    });

    const finishedAtClient = new Date().toISOString();

    if (!postResult.ok) {
      dispatch(upsertDataQueryExecution({
        dataQueryExecutionId    : dataQueryExecutionId,
        dataQueryId             : dataQueryId,
        dataSourceCredentialId  : dataSourceCredentialId,
        status                  : 'failed',
        queryTextLen            : rawQueryText.length,
        startedAt               : startedAtClient,
        finishedAt              : finishedAtClient,
        error                   : postResult.message
      }));
      return;
    }

    if (!postResult.httpOk) {
      const errorCode = postResult.errorCode;
      dispatch(upsertDataQueryExecution({
        dataQueryExecutionId    : dataQueryExecutionId,
        dataQueryId             : dataQueryId,
        dataSourceCredentialId  : dataSourceCredentialId,
        status                  : 'failed',
        queryTextLen            : rawQueryText.length,
        startedAt               : startedAtClient,
        finishedAt              : finishedAtClient,
        ...(typeof errorCode === 'string' ? { errorCode } : {}),
        error                   : postResult.message || 'Query failed'
      }));
      // AIDEV-NOTE: Reconnect UI is owned by `SQLRunnerProvider` (component layer).
      // This thunk only records execution state and error metadata.
      return;
    }

    const normalized = normalizeQueryExecutionApiPayload({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : dataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      queryTextLen            : rawQueryText.length,
      startedAtClient         : startedAtClient,
      finishedAtClient        : finishedAtClient,
      payload                 : postResult.payload
    });

    dispatch(upsertDataQueryExecution(normalized));
  }
);
