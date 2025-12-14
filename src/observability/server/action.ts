import 'server-only';

import type { ActionLogEvent, ActionOp }  from '../types';

import type { ActionMeta, ActionResult }  from '@Errors/types';
import type { HeadersContext }            from '@Utils/backendFetch';

import { ERROR_CODES }                    from '@Errors/codes';
import {
  fail, makeActionMeta,
  missingContextActionError,
  unexpectedActionError
}                                        from '@Errors/server/actionResult.server';
import { getHeadersContextOrNull }       from '@Utils/backendFetch';
import { nowMonotonicMs }                from '@Utils/time';

import { runWithLogContext, getLogger }  from './context';
import {
  getCorrelationInfo,
  runWithCorrelationInfo
}                                        from './correlation';


export type ActionWrapOptions = {
  action  : string;
  op      : ActionOp;
  input?  : Record<string, unknown>;
};

const DEBUG_ENABLED = (process.env.PGQC_LOG_LEVEL || '').toLowerCase() === 'debug';

// AIDEV-NOTE: Outer-boundary action wrapper. This MUST be called outside any 'use cache'
// functions so it runs for both cache hits and cache misses.
export async function withAction<T>(opts: ActionWrapOptions, fn: (args: { ctx: HeadersContext; correlationId: string; meta: ActionMeta }) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  const start = nowMonotonicMs();

  const correlation = await getCorrelationInfo();
  return runWithCorrelationInfo(correlation, async () => {
    const meta = makeActionMeta(opts.action);
    const ctx  = await getHeadersContextOrNull();

    return runWithLogContext({
      action        : opts.action,
      op            : opts.op,
      requestId     : meta.requestId,
      correlationId : correlation.correlationId,
      vercelId      : correlation.vercelId,
      ctx           : ctx ?? undefined
    }, async () => {
      const logger = getLogger();

      if (!ctx) {
        const result = fail<T>(meta, missingContextActionError(meta));
        const durationMs = Math.round(nowMonotonicMs() - start);

        const evt: ActionLogEvent = {
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
        };

        logger.warn(evt);
        return result;
      }

      let result: ActionResult<T>;
      try {
        result = await fn({ ctx, correlationId: correlation.correlationId, meta });
      } catch (error) {
        result = fail(meta, unexpectedActionError(meta, error));
      }

      const durationMs = Math.round(nowMonotonicMs() - start);

      if (result.success) {
        const evt: ActionLogEvent = {
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
        };

        logger.info(evt);
        return result;
      }

      const errorCode = result.error.code;
      const isUnexpected = errorCode === ERROR_CODES.unexpected.unexpected;

      const evt: ActionLogEvent = {
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
      };

      if (isUnexpected) {
        logger.error(evt);
      } else {
        logger.warn(evt);
      }

      return result;
    });
  });
}
