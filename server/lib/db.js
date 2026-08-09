// db.js — Dual MySQL + SQLite embedded storage driver.
//
// Defaults to MySQL if available; automatically falls back to an embedded SQLite
// database file (server/data/wifi_dashboard.sqlite) so full persistence (history,
// hourly rollups, events, device sightings) works out-of-the-box without MySQL setup.

import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { scoped } from './logger.js';

const log = scoped('db');

let pool = null;        // MySQL pool
let sqliteDb = null;    // SQLite connection
let dbEngine = null;    // 'mysql' | 'sqlite' | null
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

const MYSQL_SCHEMA = [
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

const SQLITE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS snapshots (
     ts      INTEGER PRIMARY KEY,
     rssi    INTEGER,
     rx_sec  REAL,
     tx_sec  REAL,
     latency REAL,
     loss    INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS hourly (
     hour    INTEGER PRIMARY KEY,
     rssi    REAL,
     rx_sec  REAL,
     tx_sec  REAL,
     latency REAL,
     loss    REAL,
     samples INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS events (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     ts       INTEGER NOT NULL,
     kind     TEXT NOT NULL,
     severity TEXT NOT NULL,
     message  TEXT NOT NULL,
     meta     TEXT
   )`,
  `CREATE TABLE IF NOT EXISTS device_history (
     mac        TEXT PRIMARY KEY,
     first_seen INTEGER NOT NULL,
     last_seen  INTEGER NOT NULL,
     last_ip    TEXT,
     seen_count INTEGER NOT NULL DEFAULT 1
   )`,
];

async function ensureDatabase(cfg) {
  try {
    const admin = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      connectTimeout: 2000,
    });
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\``);
    await admin.end();
  } catch {
    /* fallback to sqlite if mysql is unreachable */
  }
}

function initSqlite() {
  return new Promise((resolve, reject) => {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'wifi_dashboard.sqlite');
    const db = new sqlite3.Database(dbPath, async (err) => {
      if (err) return reject(err);
      sqliteDb = db;
      try {
        for (const ddl of SQLITE_SCHEMA) {
          await runSqliteDdl(ddl);
        }
        dbEngine = 'sqlite';
        ready = true;
        log.info(`SQLite embedded database ready: ${dbPath}`);
        resolve(true);
      } catch (ddlErr) {
        reject(ddlErr);
      }
    });
  });
}

function runSqliteDdl(sql) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, (err) => (err ? reject(err) : resolve()));
  });
}

export async function initDb() {
  const cfg = dbConfig();
  if (process.env.DB_DRIVER !== 'sqlite') {
    try {
      await ensureDatabase(cfg);
      pool = mysql.createPool({
        ...cfg,
        waitForConnections: true,
        connectionLimit: 8,
        maxIdle: 4,
        idleTimeout: 60000,
        namedPlaceholders: true,
        connectTimeout: 2000,
      });
      const conn = await pool.getConnection();
      for (const ddl of MYSQL_SCHEMA) await conn.query(ddl);
      conn.release();
      dbEngine = 'mysql';
      ready = true;
      log.info(`MySQL connected: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
      return ready;
    } catch (err) {
      if (pool) await pool.end().catch(() => {});
      pool = null;
      log.info(`MySQL unavailable (${err.code || err.message}), switching to SQLite embedded engine.`);
    }
  }

  // Try SQLite fallback
  try {
    await initSqlite();
  } catch (err) {
    ready = false;
    dbEngine = null;
    log.error(`SQLite initialization failed: ${err.message}. Running without persistence.`);
  }

  return ready;
}

export function isDbReady() {
  return ready;
}

export function getDbEngine() {
  return dbEngine;
}

// Convert MySQL syntax to SQLite syntax on the fly if running under SQLite engine
function translateSql(sql) {
  if (dbEngine !== 'sqlite') return sql;

  // Convert MySQL ON DUPLICATE KEY UPDATE ... VALUES(x) -> SQLite ON CONFLICT(...) DO UPDATE SET ... excluded.x
  if (sql.includes('ON DUPLICATE KEY UPDATE')) {
    if (sql.includes('INTO hourly')) {
      return `INSERT INTO hourly (hour, rssi, rx_sec, tx_sec, latency, loss, samples)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(hour) DO UPDATE SET
          rssi=excluded.rssi, rx_sec=excluded.rx_sec, tx_sec=excluded.tx_sec,
          latency=excluded.latency, loss=excluded.loss, samples=excluded.samples`;
    }
    if (sql.includes('INTO snapshots')) {
      return `INSERT INTO snapshots (ts, rssi, rx_sec, tx_sec, latency, loss)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(ts) DO UPDATE SET
          rssi=excluded.rssi, rx_sec=excluded.rx_sec, tx_sec=excluded.tx_sec,
          latency=excluded.latency, loss=excluded.loss`;
    }
  }

  return sql;
}

// Query helper returning array of objects
export async function query(sql, params = []) {
  if (!ready) return [];
  if (dbEngine === 'mysql' && pool) {
    const [rows] = await pool.query(sql, params);
    return rows;
  }
  if (dbEngine === 'sqlite' && sqliteDb) {
    const translated = translateSql(sql);
    return new Promise((resolve, reject) => {
      sqliteDb.all(translated, params, (err, rows) => {
        if (err) {
          log.error(`SQLite query error: ${err.message} (SQL: ${translated})`);
          return resolve([]);
        }
        resolve(rows || []);
      });
    });
  }
  return [];
}

// Execute helper returning result metadata { affectedRows, insertId }
export async function execute(sql, params = []) {
  if (!ready) return { affectedRows: 0, insertId: 0 };
  if (dbEngine === 'mysql' && pool) {
    const [result] = await pool.execute(sql, params);
    return result;
  }
  if (dbEngine === 'sqlite' && sqliteDb) {
    const translated = translateSql(sql);
    return new Promise((resolve, reject) => {
      sqliteDb.run(translated, params, function (err) {
        if (err) {
          log.error(`SQLite execute error: ${err.message} (SQL: ${translated})`);
          return resolve({ affectedRows: 0, insertId: 0 });
        }
        resolve({ affectedRows: this.changes || 0, insertId: this.lastID || 0 });
      });
    });
  }
  return { affectedRows: 0, insertId: 0 };
}

export async function closeDb() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
  if (sqliteDb) {
    await new Promise((resolve) => sqliteDb.close(resolve));
    sqliteDb = null;
  }
  dbEngine = null;
  ready = false;
}

