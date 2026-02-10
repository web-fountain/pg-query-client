import type { UUIDv7 }              from '@Types/primitives';
import type { DataQueryExecution }  from './types';

import { MAX_RETURN_ROWS }          from '@Constants/queryExecution';
import { isRecord }                 from '@Utils/typeGuards/isRecord';


type NormalizeQueryExecutionArgs = {
  dataQueryExecutionId: UUIDv7;
  dataQueryId: UUIDv7;
  dataSourceCredentialId: UUIDv7;
  queryTextLen: number;
  startedAtClient: string;
  finishedAtClient: string;
  payload: unknown;
};

function buildUnexpectedFailure(args: Omit<NormalizeQueryExecutionArgs, 'payload'> & { startedAt?: string; finishedAt?: string; elapsedMs?: number }): DataQueryExecution {
  const {
    dataQueryExecutionId,
    dataQueryId,
    dataSourceCredentialId,
    queryTextLen,
    startedAtClient,
    finishedAtClient,
    startedAt,
    finishedAt,
    elapsedMs
  } = args;

  return {
    dataQueryExecutionId    : dataQueryExecutionId,
    dataQueryId             : dataQueryId,
    dataSourceCredentialId  : dataSourceCredentialId,
    status                  : 'failed',
    queryTextLen            : queryTextLen,
    startedAt               : startedAt ?? startedAtClient,
    finishedAt              : finishedAt ?? finishedAtClient,
    ...(typeof elapsedMs === 'number' ? { elapsedMs } : {}),
    error                   : 'Unexpected response from server.'
  };
}

function normalizeElapsedMs(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function normalizeRowCount(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function normalizeQueryExecutionApiPayload(args: NormalizeQueryExecutionArgs): DataQueryExecution {
  const {
    dataQueryExecutionId,
    dataQueryId,
    dataSourceCredentialId,
    queryTextLen,
    startedAtClient,
    finishedAtClient,
    payload
  } = args;

  if (!isRecord(payload)) {
    return buildUnexpectedFailure({
      dataQueryExecutionId,
      dataQueryId,
      dataSourceCredentialId,
      queryTextLen,
      startedAtClient,
      finishedAtClient
    });
  }

  const okValue = payload['ok'];
  if (okValue !== true && okValue !== false) {
    return buildUnexpectedFailure({
      dataQueryExecutionId,
      dataQueryId,
      dataSourceCredentialId,
      queryTextLen,
      startedAtClient,
      finishedAtClient
    });
  }

  if (okValue === false) {
    const errorValue      = isRecord(payload['error']) ? payload['error'] : null;
    const messageValue    = errorValue && typeof errorValue['message'] === 'string' ? errorValue['message'] : null;
    const errorCodeValue  = errorValue && typeof errorValue['code'] === 'string' ? errorValue['code'] : undefined;
    const message         = messageValue && messageValue.length > 0 ? messageValue : 'Query failed';

    return {
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : dataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      status                  : 'failed',
      queryTextLen            : queryTextLen,
      startedAt               : startedAtClient,
      finishedAt              : finishedAtClient,
      ...(typeof errorCodeValue === 'string' ? { errorCode: errorCodeValue } : {}),
      error                   : message
    };
  }

  const dataValue = payload['data'];
  if (!isRecord(dataValue)) {
    return buildUnexpectedFailure({
      dataQueryExecutionId,
      dataQueryId,
      dataSourceCredentialId,
      queryTextLen,
      startedAtClient,
      finishedAtClient
    });
  }

  const startedAt = typeof dataValue['startedAt'] === 'string' ? dataValue['startedAt'] : startedAtClient;
  const finishedAt = typeof dataValue['finishedAt'] === 'string' ? dataValue['finishedAt'] : finishedAtClient;
  const elapsedMs = normalizeElapsedMs(dataValue['durationMs']);

  const backendStatus = dataValue['status'];
  if (backendStatus !== 'success' && backendStatus !== 'error') {
    return buildUnexpectedFailure({
      dataQueryExecutionId,
      dataQueryId,
      dataSourceCredentialId,
      queryTextLen,
      startedAtClient,
      finishedAtClient,
      startedAt,
      finishedAt,
      elapsedMs
    });
  }

  const rowCount = normalizeRowCount(dataValue['rowCount']);

  if (backendStatus === 'error') {
    const errorObject = isRecord(dataValue['error']) ? dataValue['error'] : null;
    const errorMessage = errorObject && typeof errorObject['message'] === 'string' ? errorObject['message'] : null;
    const errorCode = errorObject && typeof errorObject['code'] === 'string' ? errorObject['code'] : undefined;

    return {
      dataQueryExecutionId    : dataQueryExecutionId,
      dataQueryId             : dataQueryId,
      dataSourceCredentialId  : dataSourceCredentialId,
      status                  : 'failed',
      queryTextLen            : queryTextLen,
      startedAt               : startedAt,
      finishedAt              : finishedAt,
      ...(typeof elapsedMs === 'number' ? { elapsedMs } : {}),
      rowCount                : null,
      ...(typeof errorCode === 'string' ? { errorCode } : {}),
      error: (errorMessage && errorMessage.length > 0) ? errorMessage : 'Query failed'
    };
  }

  const messageFromBackend = typeof dataValue['message'] === 'string' ? dataValue['message'] : null;
  const rowsRaw = dataValue['rows'];
  if (messageFromBackend === null || !Array.isArray(rowsRaw)) {
    return buildUnexpectedFailure({
      dataQueryExecutionId,
      dataQueryId,
      dataSourceCredentialId,
      queryTextLen,
      startedAtClient,
      finishedAtClient,
      startedAt,
      finishedAt,
      elapsedMs
    });
  }

  const slicedRows = rowsRaw.length > MAX_RETURN_ROWS
    ? rowsRaw.slice(0, MAX_RETURN_ROWS)
    : rowsRaw;

  const rowObjects: Array<Record<string, unknown>> = [];
  for (const row of slicedRows) {
    if (!isRecord(row)) {
      return buildUnexpectedFailure({
        dataQueryExecutionId,
        dataQueryId,
        dataSourceCredentialId,
        queryTextLen,
        startedAtClient,
        finishedAtClient,
        startedAt,
        finishedAt,
        elapsedMs
      });
    }
    rowObjects.push(row);
  }

  const isTruncated =
    Boolean(rowObjects.length >= MAX_RETURN_ROWS && typeof rowCount === 'number' && rowCount > rowObjects.length);

  return {
    dataQueryExecutionId    : dataQueryExecutionId,
    dataQueryId             : dataQueryId,
    dataSourceCredentialId  : dataSourceCredentialId,
    status                  : 'succeeded',
    queryTextLen            : queryTextLen,
    startedAt               : startedAt,
    finishedAt              : finishedAt,
    ...(typeof elapsedMs === 'number' ? { elapsedMs } : {}),
    rows                    : rowObjects,
    rowCount                : rowCount,
    message                 : messageFromBackend,
    isTruncated             : isTruncated
  };
}
