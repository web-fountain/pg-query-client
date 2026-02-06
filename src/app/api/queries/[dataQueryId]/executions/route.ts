import 'server-only';

import type {
  QueryExecutionApiResponse,
  QueryExecutionErrorData,
  QueryExecutionSuccessData
}                                                     from '@Types/queryExecution';

import { MAX_RETURN_ROWS }                            from '@Constants/queryExecution';
import {
  getCorrelationInfo, getLogger,
  runWithCorrelationInfo, runWithLogContext
}                                                     from '@Observability/server';
import { backendFetchJSON, getHeadersContextOrNull }  from '@Utils/backendFetch';
import { generateBase64Url22 }                        from '@Utils/generateId';
import { nowMonotonicMs }                             from '@Utils/time';
import { isRecord }                                   from '@Utils/typeGuards/isRecord';

import {
  validateQueryExecutionBody,
  validateQueryExecutionParams
}                                                     from './validate';


function json(payload: QueryExecutionApiResponse, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      // AIDEV-NOTE: Never cache query execution results; they may contain sensitive data.
      'cache-control': 'no-store'
    }
  });
}

function asNonEmptyStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.length > 0 ? value : null;
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function capRows(rows: unknown[]): { rows: unknown[]; isTruncated: boolean } {
  if (!Array.isArray(rows)) return { rows: [], isTruncated: false };
  if (rows.length <= MAX_RETURN_ROWS) return { rows, isTruncated: false };
  return { rows: rows.slice(0, MAX_RETURN_ROWS), isTruncated: true };
}

function unwrapBackendOkData(payload: unknown): { ok: true; data: unknown } | { ok: false } {
  if (!isRecord(payload)) return { ok: true, data: payload };

  const okValue = payload['ok'];
  if (okValue === true) {
    return { ok: true, data: payload['data'] };
  }

  if (okValue === false) {
    return { ok: false };
  }

  return { ok: true, data: payload };
}

export async function POST(request: Request, { params }: { params: Promise<{ dataQueryId: string }> }): Promise<Response> {
  const startedAtMs = nowMonotonicMs();
  const correlation = await getCorrelationInfo();

  return runWithCorrelationInfo(correlation, async () => {
    const requestId      = generateBase64Url22();
    const headersContext = await getHeadersContextOrNull();

    return runWithLogContext({
      correlationId : correlation.correlationId,
      vercelId      : correlation.vercelId,
      requestId     : requestId,
      ctx           : headersContext ?? undefined
    }, async () => {
      const logger = getLogger();

      // AIDEV-TODO: Add server-side throttling/rate-limiting (per operator/opspace)
      // to prevent query execution spam. Keep logs high-signal and never log raw SQL.
      // AIDEV-NOTE: We cap returned rows at 1000 to protect UI/memory (client stores results in Redux).

      const resolvedParams = await params;

      const validatedParams = validateQueryExecutionParams(resolvedParams);
      if (!validatedParams.ok) {
        return json({ ok: false, error: { message: validatedParams.message } }, validatedParams.status);
      }

      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return json({ ok: false, error: { message: 'Invalid JSON.' } }, 400);
      }

      const validatedBody = validateQueryExecutionBody(rawBody);
      if (!validatedBody.ok) {
        return json({ ok: false, error: { message: validatedBody.message } }, validatedBody.status);
      }

      const { dataQueryId } = validatedParams.value;
      const { dataQueryExecutionId, dataSourceCredentialId, queryText } = validatedBody.value;

      logger.info({
        event                   : 'queryExecution.proxy',
        phase                   : 'start',
        dataQueryId             : dataQueryId,
        dataQueryExecutionId    : dataQueryExecutionId,
        dataSourceCredentialId  : dataSourceCredentialId,
        queryTextLen            : queryText.length
      });

      const backendResult = await backendFetchJSON<unknown>({
        path      : `/queries/${dataQueryId}/executions`,
        method    : 'POST',
        scope     : ['queries:execute'],
        logLabel  : 'queryExecutionProxy',
        timeoutMs : 120_000,
        context   : headersContext ?? undefined,
        body      : {
          dataQueryExecutionId,
          dataSourceCredentialId,
          queryText
        }
      });

      const elapsedMs = Math.round(nowMonotonicMs() - startedAtMs);

      if (!backendResult.ok) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-failed',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          status                : backendResult.status,
          elapsedMs             : elapsedMs
        });
        const status = backendResult.status && backendResult.status > 0 ? backendResult.status : 502;
        return json({ ok: false, error: { message: 'Failed to execute query.' } }, status);
      }

      const unwrapped = unwrapBackendOkData(backendResult.data);
      if (!unwrapped.ok) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-ok-false',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Query execution failed.' } }, 502);
      }

      const backendData = unwrapped.data;
      const backendRecord = isRecord(backendData) ? backendData : null;
      if (!backendRecord) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      const rawStatus = backendRecord['status'];
      const status = rawStatus === 'success' || rawStatus === 'error' ? rawStatus : null;
      if (!status) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs,
          statusType            : typeof rawStatus
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      const startedAtBackend = asNonEmptyStringOrNull(backendRecord['startedAt']);
      const finishedAtBackend = asNonEmptyStringOrNull(backendRecord['finishedAt']);
      const durationMsBackend = asNonNegativeInt(backendRecord['durationMs']);

      const rowCountRaw = backendRecord['rowCount'];
      const hasValidRowCount =
        rowCountRaw === null
          || (typeof rowCountRaw === 'number' && Number.isFinite(rowCountRaw) && rowCountRaw >= 0);
      const rowCount = hasValidRowCount
        ? (rowCountRaw === null ? null : Math.round(rowCountRaw))
        : null;

      if (!startedAtBackend || !finishedAtBackend || durationMsBackend === null || !hasValidRowCount) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      if (status === 'success') {
        const messageRaw = backendRecord['message'];
        if (typeof messageRaw !== 'string') {
          logger.warn({
            event                 : 'queryExecution.proxy',
            phase                 : 'backend-shape',
            dataQueryId           : dataQueryId,
            dataQueryExecutionId  : dataQueryExecutionId,
            elapsedMs             : elapsedMs
          });
          return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
        }

        const rowsRaw = backendRecord['rows'];
        if (!Array.isArray(rowsRaw)) {
          logger.warn({
            event                 : 'queryExecution.proxy',
            phase                 : 'backend-shape',
            dataQueryId           : dataQueryId,
            dataQueryExecutionId  : dataQueryExecutionId,
            elapsedMs             : elapsedMs
          });
          return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
        }

        const cappedRows = capRows(rowsRaw as unknown[]);
        const rowObjects: Array<Record<string, unknown>> = [];

        for (const row of cappedRows.rows) {
          if (!isRecord(row)) {
            logger.warn({
              event                 : 'queryExecution.proxy',
              phase                 : 'backend-shape',
              dataQueryId           : dataQueryId,
              dataQueryExecutionId  : dataQueryExecutionId,
              elapsedMs             : elapsedMs
            });
            return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
          }
          rowObjects.push(row);
        }

        let message = messageRaw;
        if (cappedRows.isTruncated) {
          const suffix = `Showing first ${MAX_RETURN_ROWS} rows.`;
          message = message ? `${message} ${suffix}` : suffix;
        }

        const responseData: QueryExecutionSuccessData = {
          dataQueryExecutionId,
          dataQueryId,
          dataSourceCredentialId,
          status: 'success',
          startedAt: startedAtBackend,
          finishedAt: finishedAtBackend,
          durationMs: durationMsBackend,
          rowCount,
          message,
          rows: rowObjects
        };

        logger.info({
          event                 : 'queryExecution.proxy',
          phase                 : 'complete',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          status                : 'success',
          durationMs            : durationMsBackend,
          returnedRows          : rowObjects.length,
          rowCount              : rowCount
        });

        return json({ ok: true, data: responseData }, 200);
      }

      // status === 'error'
      if (rowCountRaw !== null) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      const rawError = backendRecord['error'];
      if (!isRecord(rawError)) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      const errorMessage = asNonEmptyStringOrNull(rawError['message']);
      const errorCode = asNonEmptyStringOrNull(rawError['code']);
      if (!errorMessage) {
        logger.warn({
          event                 : 'queryExecution.proxy',
          phase                 : 'backend-shape',
          dataQueryId           : dataQueryId,
          dataQueryExecutionId  : dataQueryExecutionId,
          elapsedMs             : elapsedMs
        });
        return json({ ok: false, error: { message: 'Unexpected backend response.' } }, 502);
      }

      const responseData: QueryExecutionErrorData = {
        dataQueryExecutionId,
        dataQueryId,
        dataSourceCredentialId,
        status: 'error',
        startedAt: startedAtBackend,
        finishedAt: finishedAtBackend,
        durationMs: durationMsBackend,
        rowCount: null,
        error: errorCode ? { code: errorCode, message: errorMessage } : { message: errorMessage }
      };

      logger.info({
        event                 : 'queryExecution.proxy',
        phase                 : 'complete',
        dataQueryId           : dataQueryId,
        dataQueryExecutionId  : dataQueryExecutionId,
        status                : 'error',
        durationMs            : durationMsBackend,
        returnedRows          : 0,
        rowCount              : null
      });

      return json({ ok: true, data: responseData }, 200);
    });
  });
}
