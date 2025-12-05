import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const VRIKSH_HOME = path.join(os.homedir(), '.vriksh');
const DB_PATH = path.join(VRIKSH_HOME, 'state.sqlite');

export class StateStore {
  private db: Database.Database;

  constructor() {
    fs.ensureDirSync(VRIKSH_HOME);
    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  private initSchema() {
    // Runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        lab_id TEXT NOT NULL,
        status TEXT NOT NULL,
        backend TEXT DEFAULT 'docker',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Providers table (tracks containers/resources per run)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        type TEXT NOT NULL,
        resource_id TEXT, -- Docker container ID or similar
        metadata TEXT, -- JSON blob for connection info, creds
        status TEXT,
        FOREIGN KEY(run_id) REFERENCES runs(id)
      )
    `);

    // Logs/Events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT,
        payload TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(run_id) REFERENCES runs(id)
      )
    `);
  }

  createRun(runId: string, labId: string) {
    const stmt = this.db.prepare('INSERT INTO runs (id, lab_id, status) VALUES (?, ?, ?)');
    stmt.run(runId, labId, 'PENDING');
  }

  updateRunStatus(runId: string, status: string) {
    const stmt = this.db.prepare('UPDATE runs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, runId);
  }

  addProvider(runId: string, providerId: string, type: string, resourceId: string, metadata: any) {
    const stmt = this.db.prepare(`
      INSERT INTO providers (run_id, provider_id, type, resource_id, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(runId, providerId, type, resourceId, JSON.stringify(metadata), 'PROVISIONED');
  }

  getProviders(runId: string) {
    const stmt = this.db.prepare('SELECT * FROM providers WHERE run_id = ?');
    const rows = stmt.all(runId) as any[];
    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata)
    }));
  }

  logEvent(runId: string, type: string, message: string, payload?: any) {
    const stmt = this.db.prepare('INSERT INTO events (run_id, type, message, payload) VALUES (?, ?, ?, ?)');
    stmt.run(runId, type, message, payload ? JSON.stringify(payload) : null);
  }

  getEvents(runId: string) {
      const stmt = this.db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY id ASC');
      return stmt.all(runId);
  }

  getRun(runId: string) {
    const stmt = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    return stmt.get(runId);
  }

  getLastRun() {
      const stmt = this.db.prepare('SELECT * FROM runs ORDER BY created_at DESC LIMIT 1');
      return stmt.get();
  }
}

export const stateStore = new StateStore();