import 'server-only';

import type { ActionOp }                  from '../types';

import type { ActionMeta, ActionResult }  from '@Errors/types';
import type { HeadersContext }            from '@Utils/backendFetch';

import { ERROR_CODES }                    from '@Errors/codes';
import {
  fail,
  makeActionMeta,
  missingContextActionError,
  unexpectedActionError
}                                        from '@Errors/server/actionResult.server';
import { getHeadersContextOrNull }       from '@Utils/backendFetch';
import {
  getCorrelationInfo,
  runWithCorrelationInfo
}                                        from '@Observability/server';
import { logJson }                       from './logger';


export type ActionWrapOptions = {
  action  : string;
  op      : ActionOp;
  input?  : Record<string, unknown>;
};

const DEBUG_ENABLED = (process.env.PGQC_LOG_LEVEL || '').toLowerCase() === 'debug';

// AIDEV-NOTE: Use a monotonic clock for durations (avoid wall-clock jumps).
function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

// AIDEV-NOTE: Outer-boundary action wrapper. This MUST be called outside any 'use cache'
// functions so it runs for both cache hits and cache misses.
export async function withAction<T>(opts: ActionWrapOptions, fn: (args: { ctx: HeadersContext; correlationId: string; meta: ActionMeta }) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const start = nowMs();

  const correlation = await getCorrelationInfo();
  return runWithCorrelationInfo(correlation, async () => {
    const meta  = makeActionMeta(opts.action);
    const ctx   = await getHeadersContextOrNull();

    if (!ctx) {
      const result = fail<T>(meta, missingContextActionError(meta));
      const durationMs = Math.round(nowMs() - start);

      logJson('warn', {
        event         : 'action',
        action        : opts.action,
        op            : opts.op,
        success       : false,
        durationMs    : durationMs,
        requestId     : meta.requestId,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId,
        errorCode     : ERROR_CODES.context.missingContext,
        input         : opts.input
      });

      return result;
    }

    let result: ActionResult<T>;
    try {
      result = await fn({ ctx, correlationId: correlation.correlationId, meta });
    } catch (error) {
      result = fail(meta, unexpectedActionError(meta, error));
    }

    const durationMs = Math.round(nowMs() - start);

    if (result.success) {
      logJson('info', {
        event         : 'action',
        action        : opts.action,
        op            : opts.op,
        success       : true,
        durationMs    : durationMs,
        requestId     : meta.requestId,
        ctx           : ctx,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId,
        input         : opts.input
      });
      return result;
    }

    const errorCode = result.error.code;
    const isUnexpected = errorCode === ERROR_CODES.unexpected.unexpected;

    logJson(isUnexpected ? 'error' : 'warn', {
      event         : 'action',
      action        : opts.action,
      op            : opts.op,
      success       : false,
      durationMs    : durationMs,
      requestId     : meta.requestId,
      ctx           : ctx,
      correlationId : correlation.correlationId,
      vercelId      : correlation.vercelId,
      errorCode     : errorCode,
      errorKind     : result.error.kind,
      status        : result.error.status,
      retryable     : result.error.retryable,
      errorMessage  : DEBUG_ENABLED ? result.error.message : undefined,
      input         : opts.input
    });

    return result;
  });
}
