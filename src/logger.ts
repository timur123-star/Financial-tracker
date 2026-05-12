import { config } from './config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level: Level): boolean {
  const cfg = (config.logLevel as Level) ?? 'info';
  return order[level] >= (order[cfg] ?? order.info);
}

function fmt(level: Level, args: unknown[]): unknown[] {
  return [`[${new Date().toISOString()}] [${level.toUpperCase()}]`, ...args];
}

export const log = {
  debug: (...args: unknown[]) => shouldLog('debug') && console.log(...fmt('debug', args)),
  info: (...args: unknown[]) => shouldLog('info') && console.log(...fmt('info', args)),
  warn: (...args: unknown[]) => shouldLog('warn') && console.warn(...fmt('warn', args)),
  error: (...args: unknown[]) => shouldLog('error') && console.error(...fmt('error', args)),
};
