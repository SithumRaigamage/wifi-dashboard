// db.js — MySQL connection pool + schema for all persisted data
// (snapshots, hourly rollups, events, device_history).
//
// The app degrades gracefully: if MySQL can't be reached at startup (e.g. creds
// not wired yet), it logs setup instructions and runs in "no-persistence" mode —
// live metrics over WebSocket still work, but history/events aren't stored and
// their queries return empty. Set the DB_* vars in server/.env, then restart.

import mysql from 'mysql2/promise';
import { scoped } from './logger.js';

const log = scoped('db');

let pool = null;
let ready = false;

function dbConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wifi_dashboard',
  };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS snapshots (
     ts      BIGINT PRIMARY KEY,
     rssi    INT,
     rx_sec  DOUBLE,
     tx_sec  DOUBLE,
     latency DOUBLE,
     loss    INT
   )`,
  `CREATE TABLE IF NOT EXISTS hourly (
     hour    BIGINT PRIMARY KEY,
     rssi    DOUBLE,
     rx_sec  DOUBLE,
     tx_sec  DOUBLE,
     latency DOUBLE,
     loss    DOUBLE,
     samples INT NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     id       BIGINT PRIMARY KEY AUTO_INCREMENT,
     ts       BIGINT NOT NULL,
     kind     VARCHAR(32) NOT NULL,
     severity VARCHAR(16) NOT NULL,
     message  TEXT NOT NULL,
     meta     JSON,
     INDEX idx_events_ts (ts)
   )`,
  `CREATE TABLE IF NOT EXISTS device_history (
     mac        VARCHAR(32) PRIMARY KEY,
     first_seen BIGINT NOT NULL,
     last_seen  BIGINT NOT NULL,
     last_ip    VARCHAR(64),
     seen_count INT NOT NULL DEFAULT 1
   )`,
];

// Best-effort: create the database if the configured user is privileged enough.
// Ignored if it already exists or the user lacks CREATE privilege (the bootstrap
// script handles that case).
async function ensureDatabase(cfg) {
  try {
    const admin = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
    });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\``);
    await admin.end();
  } catch {
    /* no privilege / already exists — the pool connect below is the real test */
  }
}

export async function initDb() {
  const cfg = dbConfig();
  try {
    await ensureDatabase(cfg);
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 8,
      maxIdle: 4,
      idleTimeout: 60000,
      namedPlaceholders: true,
    });
    // Verify connectivity + create tables.
    const conn = await pool.getConnection();
    for (const ddl of SCHEMA) await conn.query(ddl);
    conn.release();
    ready = true;
    log.info(`MySQL connected: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
  } catch (err) {
    ready = false;
    pool = null;
    log.warn(
      `MySQL unavailable (${err.code || err.message}). Running WITHOUT persistence — ` +
        `history + events won't be saved. To enable: (1) mysql -u root -p < server/sql/init.sql, ` +
        `(2) set DB_PASSWORD in server/.env, (3) restart.`
    );
  }
  return ready;
}

export function isDbReady() {
  return ready;
}

// Thin query helper. Returns [] when persistence is off so callers can treat a
// missing DB the same as an empty result set.
export async function query(sql, params) {
  if (!ready || !pool) return [];
  const [rows] = await pool.query(sql, params);
  return rows;
}

// For INSERT/UPDATE/DELETE where the caller wants the result meta (insertId etc).
export async function execute(sql, params) {
  if (!ready || !pool) return { affectedRows: 0, insertId: 0 };
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
  ready = false;
}
