import type { LogLevel } from '../types';

// AIDEV-NOTE: Edge-safe structured logger (console JSON).
// Use this from middleware/Edge runtime code. Do NOT import the Node/Pino logger here.

const DEFAULT_LEVEL: LogLevel = 'info';

function getLogLevel(): LogLevel {
  const raw   = process.env.PGQC_LOG_LEVEL || '';
  const level = raw.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') return level;
  return DEFAULT_LEVEL;
}

function isLevelEnabled(level: LogLevel, current: LogLevel): boolean {
  const order: Record<LogLevel, number> = {
    debug : 10,
    info  : 20,
    warn  : 30,
    error : 40
  };
  return order[level] >= order[current];
}

export function logJson(level: LogLevel, payload: Record<string, unknown>): void {
  const current = getLogLevel();
  if (!isLevelEnabled(level, current)) return;

  const line = JSON.stringify({
    level : level,
    ts    : new Date().toISOString(),
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
