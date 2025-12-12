import 'server-only';

// This module will contain shared helpers for logging HTTP client/server events.
// For v1, server actions will rely primarily on action-level events plus selective backendFetch logs.

import type { ActionLogContext, LogLevel } from '../types';

import { logJson } from './logger';


export type BackendCallLogEvent = {
  event           : 'backendFetch';
  label           : string;
  method          : string;
  url             : string;
  status          : number;
  durationMs      : number;
  correlationId?  : string;
  vercelId?       : string;
  errorCode?      : string;
  errorMessage?   : string;
  ctx?            : ActionLogContext;
};

export function logBackendCall(level: LogLevel, evt: BackendCallLogEvent): void {
  logJson(level, evt as unknown as Record<string, unknown>);
}
