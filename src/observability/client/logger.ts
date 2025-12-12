import type { LogLevel } from '../types';

// AIDEV-NOTE: Client-side structured logger for browser console.
// This is for developer debugging; Vercel does not capture browser console output.
// Policy:
// - Prefer one-line JSON for easy copy/paste.
// - Never log SQL/queryText, tokens, cookies, or other secrets.

export type ClientLogPayload = Record<string, unknown>;
export type ClientLogPayloadFactory = () => ClientLogPayload;
export type ClientLogPayloadOrFactory = ClientLogPayload | ClientLogPayloadFactory;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug : 10,
  info  : 20,
  warn  : 30,
  error : 40
};

const DEFAULT_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

// AIDEV-NOTE: Only NEXT_PUBLIC_* env vars are available in the browser bundle.
const CLIENT_LOG_LEVEL: LogLevel = (() => {
  const raw = (process.env.NEXT_PUBLIC_PGQC_LOG_LEVEL || '').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return DEFAULT_LEVEL;
})();

const CLIENT_LEVEL_RANK = LEVEL_RANK[CLIENT_LOG_LEVEL];

const CONSOLE_BY_LEVEL: Record<LogLevel, (...args: unknown[]) => void> = {
  debug : console.log.bind(console),
  info  : console.log.bind(console),
  warn  : console.warn.bind(console),
  error : console.error.bind(console)
};

export function getClientLogLevel(): LogLevel {
  return CLIENT_LOG_LEVEL;
}

export function isClientLogEnabled(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= CLIENT_LEVEL_RANK;
}

export function logClientJson(level: LogLevel, payload: ClientLogPayloadOrFactory): void {
  // AIDEV-NOTE: Hot path — short-circuit before allocating/serializing.
  if (!isClientLogEnabled(level)) return;

  const p = typeof payload === 'function' ? payload() : payload;
  const line = JSON.stringify(Object.assign({}, p, {
    level,
    ts: new Date().toISOString()
  }));
  CONSOLE_BY_LEVEL[level](line);
}
