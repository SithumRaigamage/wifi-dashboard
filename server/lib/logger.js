// logger.js — Winston logger for the backend.
//
// Levels used across the app: error, warn, info, debug.
//   error — failures that need attention (DB down, send failures, crashes)
//   warn  — recoverable/degraded conditions (running without persistence)
//   info  — lifecycle + notable events (startup, connections, alerts emitted)
//   debug — per-tick / verbose detail (off by default)
//
// Console output is colorized + timestamped. All logs also go to files under
// server/logs/ (combined.log, plus error.log for warn+error). Set LOG_LEVEL to
// raise/lower verbosity (LOG_LEVEL=debug to see debug lines).

import winston from 'winston';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, '..', 'logs');
try {
  mkdirSync(logDir, { recursive: true });
} catch {
  /* fall back to console-only if the dir can't be created */
}

const level = process.env.LOG_LEVEL || 'info';

// "2026-07-04 10:30:00 info: message {meta}"
const line = winston.format.printf(({ timestamp, level: lvl, message, ...meta }) => {
  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${lvl}: ${message}${rest}`;
});

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    line
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), line),
    }),
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'warn', // warn + error
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: join(logDir, 'combined.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// Convenience: a child logger tagged with a component name, e.g.
//   const log = scoped('db'); log.warn('...')  → "[db] ..."
export function scoped(component) {
  return {
    error: (msg, meta) => logger.error(`[${component}] ${msg}`, meta),
    warn: (msg, meta) => logger.warn(`[${component}] ${msg}`, meta),
    info: (msg, meta) => logger.info(`[${component}] ${msg}`, meta),
    debug: (msg, meta) => logger.debug(`[${component}] ${msg}`, meta),
  };
}
