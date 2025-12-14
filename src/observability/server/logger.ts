import 'server-only';

import type { Logger, LoggerOptions } from 'pino';
import type { LogLevel }              from '../types';
import pino                           from 'pino';

// AIDEV-NOTE: Node.js server logger (Pino).
// Do NOT import this module from Edge runtime code (middleware). Use `@Observability/edge/logger` there.

const DEFAULT_LEVEL: LogLevel = 'info';

export function getLogLevel(): LogLevel {
  const raw   = process.env.PGQC_LOG_LEVEL || '';
  const level = raw.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') return level;
  return DEFAULT_LEVEL;
}

function isPrettyEnabled(): boolean {
  // AIDEV-NOTE: `pino-pretty` is dev-only; never enable in production/serverless.
  return process.env.NODE_ENV !== 'production' && (process.env.PGQC_LOG_PRETTY || '').toLowerCase() === 'true';
}

function createPinoLogger(): Logger {
  const opts: LoggerOptions = {
    level: getLogLevel(),
    base: null,
    formatters: {
      level(label) {
        return { level: label };
      }
    },
    redact: {
      // AIDEV-NOTE: Safety net. Call sites must still avoid logging sensitive payloads.
      paths: [
        'authorization',
        'cookie',
        'token',
        'jwt',
        'secret',
        'password',
        'queryText',
        'querytext',
        'headers.authorization',
        'headers.cookie',
        'headers.token',
        'headers.jwt',
        'headers.secret',
        'headers.password',
        'headers.queryText',
        'headers.querytext',
        'headers["set-cookie"]',
        'requestHeaders.authorization',
        'requestHeaders.cookie',
        'requestHeaders.token',
        'requestHeaders.jwt',
        'requestHeaders.secret',
        'requestHeaders.password',
        'requestHeaders.queryText',
        'requestHeaders.querytext',
        'requestHeaders["set-cookie"]',
        'input.queryText',
        'input.querytext',
        'audit.queryText',
        'audit.querytext',
        'body.queryText',
        'body.querytext'
      ],
      censor: '[redacted]'
    }
  };

  if (isPrettyEnabled()) {
    // AIDEV-NOTE: `pino.transport(...)` uses a worker thread. This is safe as long as
    // Pino deps are not bundled (see `next.config.ts` `serverExternalPackages`).
    const transport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize      : true,
        translateTime : 'SYS:standard',
        singleLine    : true,
        ignore        : 'pid,hostname'
      }
    });
    return pino(opts, transport);
  }

  return pino(opts);
}

type GlobalWithLogger = typeof globalThis & { __pgqcPinoLogger?: Logger };
const globalWithLogger = globalThis as GlobalWithLogger;

// AIDEV-NOTE: Next.js dev/HMR can evaluate modules multiple times.
// Cache the base logger on globalThis to avoid duplicate transports/destinations.
const baseLogger: Logger =
  process.env.NODE_ENV === 'production'
    ? createPinoLogger()
    : (globalWithLogger.__pgqcPinoLogger ?? (globalWithLogger.__pgqcPinoLogger = createPinoLogger()));

export function getBaseLogger(): Logger {
  return baseLogger;
}
