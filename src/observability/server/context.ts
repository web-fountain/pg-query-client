import 'server-only';

import type { Logger }                      from 'pino';
import type { Base64Url22 }                 from '@Types/primitives';
import type { ActionLogContext, ActionOp }  from '../types';

import { AsyncLocalStorage }                from 'node:async_hooks';
import { getBaseLogger }                    from './logger';

// AIDEV-NOTE: Request/action-scoped logger context. This lets us:
// - attach correlationId/requestId/ctx once via a child logger (ergonomics + less duplication)
// - fetch the correct logger from anywhere (backendFetch, route handlers, etc)
export type ServerLogBindings = {
  correlationId?  : string;
  vercelId?       : string;
  requestId?      : Base64Url22;
  action?         : string;
  op?             : ActionOp;
  ctx?            : ActionLogContext;
};

export type ServerLogContext = {
  logger    : Logger;
  bindings  : ServerLogBindings;
};

const logStore = new AsyncLocalStorage<ServerLogContext>();

export function getLogContext(): ServerLogContext | null {
  return logStore.getStore() || null;
}

export function getLogger(): Logger {
  return getLogContext()?.logger ?? getBaseLogger();
}

export async function runWithLogContext<T>(bindings: ServerLogBindings, fn: () => Promise<T>): Promise<T> {
  const logger = getBaseLogger().child(bindings);
  return logStore.run({ logger, bindings }, fn);
}
