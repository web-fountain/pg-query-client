import type { ReduxDispatch }  from '@Redux/store';
import type { UUIDv7 }         from '@Types/primitives';

import { logAudit }            from '@Observability/client/audit';
import { generateUUIDv7 }      from '@Utils/generateId';
import { upsertDataQueryExecution } from './index';

import { postQueryExecution }  from './api';
import { normalizeQueryExecutionApiPayload } from './normalize';


type ExecuteDataQueryExecutionArgs = {
  dataQueryId: UUIDv7;
  dataSourceCredentialId: UUIDv7;
  queryText: string;
  dispatch: ReduxDispatch;
};

type ExecuteDataQueryExecutionResult = {
  didRun: boolean;
  shouldReconnectSecretNotFound: boolean;
  reconnectReasonMessage: string | null;
};

async function executeDataQueryExecution(args: ExecuteDataQueryExecutionArgs): Promise<ExecuteDataQueryExecutionResult> {
  // AIDEV-NOTE: Preserve original SQL exactly; only guard against fully-empty (whitespace-only) submissions.
  const rawQueryText = args.queryText;
  if ((rawQueryText || '').trim().length === 0) {
    return {
      didRun: false,
      shouldReconnectSecretNotFound: false,
      reconnectReasonMessage: null
    };
  }

  // AIDEV-TODO: Add cancellation semantics (AbortController + backend cancel endpoint) once supported.
  const dataQueryExecutionId = generateUUIDv7();
  const startedAtClient = new Date().toISOString();

  // AIDEV-NOTE: Keep raw SQL out of Redux actions/state. We only persist length in Redux.
  // This avoids leaking query text via action meta/DevTools while still supporting execution.
  args.dispatch(upsertDataQueryExecution({
    dataQueryExecutionId    : dataQueryExecutionId,
    dataQueryId             : args.dataQueryId,
    dataSourceCredentialId  : args.dataSourceCredentialId,
    status                  : 'running',
    queryTextLen            : rawQueryText.length,
    startedAt               : startedAtClient
  }));

  // AIDEV-NOTE: Fire-and-forget audit event for correlation/compliance; never include raw SQL.
  try {
    logAudit({ event: 'query:execute', dataQueryId: args.dataQueryId });
  } catch {}

  const postResult = await postQueryExecution({
    dataQueryId             : args.dataQueryId,
    dataQueryExecutionId    : dataQueryExecutionId,
    dataSourceCredentialId  : args.dataSourceCredentialId,
    queryText               : rawQueryText
  });

  const finishedAtClient = new Date().toISOString();

  if (!postResult.ok) {
    args.dispatch(upsertDataQueryExecution({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : args.dataQueryId,
      dataSourceCredentialId  : args.dataSourceCredentialId,
      status                  : 'failed',
      queryTextLen            : rawQueryText.length,
      startedAt               : startedAtClient,
      finishedAt              : finishedAtClient,
      error                   : postResult.message
    }));

    return {
      didRun: true,
      shouldReconnectSecretNotFound: false,
      reconnectReasonMessage: null
    };
  }

  if (!postResult.httpOk) {
    const errorCode = postResult.errorCode;

    args.dispatch(upsertDataQueryExecution({
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : args.dataQueryId,
      dataSourceCredentialId  : args.dataSourceCredentialId,
      status                  : 'failed',
      queryTextLen            : rawQueryText.length,
      startedAt               : startedAtClient,
      finishedAt              : finishedAtClient,
      ...(typeof errorCode === 'string' ? { errorCode } : {}),
      error                   : postResult.message || 'Query failed'
    }));

    const shouldReconnectSecretNotFound = errorCode === 'secret_not_found';
    return {
      didRun: true,
      shouldReconnectSecretNotFound,
      reconnectReasonMessage: shouldReconnectSecretNotFound ? (postResult.message || null) : null
    };
  }

  const normalized = normalizeQueryExecutionApiPayload({
    dataQueryExecutionId    : dataQueryExecutionId,
    dataQueryId             : args.dataQueryId,
    dataSourceCredentialId  : args.dataSourceCredentialId,
    queryTextLen            : rawQueryText.length,
    startedAtClient         : startedAtClient,
    finishedAtClient        : finishedAtClient,
    payload                 : postResult.payload
  });

  args.dispatch(upsertDataQueryExecution(normalized));

  const shouldReconnectSecretNotFound =
    normalized.status === 'failed' && normalized.errorCode === 'secret_not_found';

  return {
    didRun: true,
    shouldReconnectSecretNotFound,
    reconnectReasonMessage: shouldReconnectSecretNotFound ? (normalized.error || null) : null
  };
}


export type { ExecuteDataQueryExecutionArgs, ExecuteDataQueryExecutionResult };
export { executeDataQueryExecution };
