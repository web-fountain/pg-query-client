import 'server-only';

import type { LogLevel } from '../types';

// Vercel best practice is to log JSON to stdout/stderr for queryability.
// This module will become the single entry point for server-side structured logs.

const DEFAULT_LEVEL: LogLevel = 'info';

export function getLogLevel(): LogLevel {
  const raw   = process.env.PGQC_LOG_LEVEL || '';
  const level = raw.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') return level;
  return DEFAULT_LEVEL;
}

export function isLevelEnabled(level: LogLevel, current: LogLevel): boolean {
  const order: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
  };
  return order[level] >= order[current];
}

export function logJson(level: LogLevel, payload: Record<string, unknown>): void {
  const current = getLogLevel();
  if (!isLevelEnabled(level, current)) return;

  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...payload
  });

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}
