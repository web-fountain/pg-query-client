import type { ActionResult }  from '@Errors/types';
import { formatError }        from '@Utils/error';
import { logClientJson }      from './logger';


const DEV = process.env.NODE_ENV !== 'production';

export type ThunkLogInput = Record<string, unknown>;

type LogThunkStartArgs = {
  thunk   : string;
  input?  : ThunkLogInput;
};

type LogThunkResultArgs = {
  thunk   : string;
  result  : ActionResult<unknown>;
  input?  : ThunkLogInput;
};

type LogThunkExceptionArgs = {
  thunk   : string;
  message : string;
  error   : unknown;
  input?  : ThunkLogInput;
};

// AIDEV-NOTE: Use in Redux thunks as a replacement for ad-hoc console.* logging.
// Keep input summaries to IDs and lengths only (never SQL/queryText).
export function logThunkStart(args: LogThunkStartArgs): void {
  logClientJson('debug', () => ({
    event : 'thunk',
    phase : 'start',
    thunk : args.thunk,
    input : args.input
  }));
}

export function logThunkResult(args: LogThunkResultArgs): void {
  const { thunk, result, input } = args;

  if (result.success) {
    logClientJson('debug', () => ({
      event     : 'thunk',
      phase     : 'success',
      thunk     : thunk,
      action    : result.meta.action,
      requestId : result.meta.requestId,
      input     : input
    }));
    return;
  }

  const level = result.error.kind === 'unexpected' ? 'error' : 'warn';
  logClientJson(level, () => ({
    event         : 'thunk',
    phase         : 'failure',
    thunk         : thunk,
    action        : result.meta.action,
    requestId     : result.meta.requestId,
    errorCode     : result.error.code,
    errorKind     : result.error.kind,
    status        : result.error.status,
    retryable     : result.error.retryable,
    errorMessage  : DEV ? result.error.message : undefined,
    input         : input
  }));
}

export function logThunkException(args: LogThunkExceptionArgs): void {
  logClientJson('error', () => ({
    event   : 'thunk',
    phase   : 'exception',
    thunk   : args.thunk,
    message : args.message,
    error   : DEV ? formatError(args.error) : undefined,
    input   : args.input
  }));
}

export {
  logThunkStart     as thunkStart,
  logThunkResult    as thunkResult,
  logThunkException as thunkException
};
