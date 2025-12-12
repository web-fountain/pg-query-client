import 'server-only';

import { cache }                from 'react';
import { headers }              from 'next/headers';
import { AsyncLocalStorage }    from 'node:async_hooks';
import { generateBase64Url22 }  from '@Utils/generateId';

// Correlation is required to stitch together:
// - Vercel function invocation logs
// - server action events
// - backendFetchJSON events
// - backend logs (future)

export type CorrelationInfo = {
  correlationId : string;
  vercelId?     : string;
};

// AIDEV-NOTE: Request-local store for correlation attributes.
// This avoids calling Next.js dynamic APIs (headers/cookies) inside "use cache" scopes.
const correlationStore = new AsyncLocalStorage<CorrelationInfo>();

export function createCorrelationId(): string {
  return generateBase64Url22();
}

export function getCorrelationInfoFromContext(): CorrelationInfo | null {
  return correlationStore.getStore() || null;
}

export async function runWithCorrelationInfo<T>(info: CorrelationInfo, fn: () => Promise<T>): Promise<T> {
  return correlationStore.run(info, fn);
}

// Request-scoped memoization so a single request/action invocation uses
// one stable correlationId across all logs + backend calls.
const getCorrelationInfoCached = cache(async (): Promise<CorrelationInfo> => {
  const hdrs = await headers();

  const vercelId      = hdrs.get('x-vercel-id') || undefined;
  const correlationId = hdrs.get('x-correlation-id') || createCorrelationId();

  return { correlationId, vercelId };
});

export async function getCorrelationInfo(): Promise<CorrelationInfo> {
  const fromContext = getCorrelationInfoFromContext();
  if (fromContext) {
    return fromContext;
  }
  return getCorrelationInfoCached();
}
