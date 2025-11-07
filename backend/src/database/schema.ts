import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/database.sqlite';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
export function initDatabase() {
  // Model configurations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('translation', 'review', 'synthesis', 'embedding')),
      api_endpoint TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_id TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      owner_user_id TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      -- whether streaming is enabled for this model (0/1)
      stream_enabled INTEGER DEFAULT 0,
      temperature REAL,
      max_tokens INTEGER,
      top_p REAL,
      frequency_penalty REAL,
      presence_penalty REAL,
      custom_params TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      order_num INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Try to add stream_enabled if missing (older databases)
  try {
    db.exec(`ALTER TABLE model_configs ADD COLUMN stream_enabled INTEGER DEFAULT 0`);
  } catch (e) {
    // ignore if column already exists
  }
  try { db.exec(`ALTER TABLE model_configs ADD COLUMN owner_user_id TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE model_configs ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`); } catch (e) {}

  // Knowledge base table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      embedding_model_id TEXT NOT NULL,
      owner_user_id TEXT,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (embedding_model_id) REFERENCES model_configs(id) ON DELETE RESTRICT
    )
  `);
  try { db.exec(`ALTER TABLE knowledge_bases ADD COLUMN owner_user_id TEXT`); } catch (e) {}
  try { db.exec(`ALTER TABLE knowledge_bases ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`); } catch (e) {}

  // Translation history table (will be extended with user_id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_history (
      id TEXT PRIMARY KEY,
      source_text TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Application settings (key/value)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','user')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Per-user model preferences (enable/disable shared models locally)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_model_prefs (
      user_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      PRIMARY KEY (user_id, model_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES model_configs(id) ON DELETE CASCADE
    )
  `);

  // Per-user knowledge base preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_kb_prefs (
      user_id TEXT NOT NULL,
      kb_id TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      PRIMARY KEY (user_id, kb_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    )
  `);

  // Try to add user_id to translation_history for per-user isolation (older databases)
  try {
    db.exec(`ALTER TABLE translation_history ADD COLUMN user_id TEXT`);
  } catch (e) {
    // ignore if column already exists
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_model_configs_stage ON model_configs(stage);
    CREATE INDEX IF NOT EXISTS idx_model_configs_enabled ON model_configs(enabled);
    CREATE INDEX IF NOT EXISTS idx_model_configs_owner_stage ON model_configs(owner_user_id, stage);
    CREATE INDEX IF NOT EXISTS idx_model_configs_is_public ON model_configs(is_public);
    CREATE INDEX IF NOT EXISTS idx_knowledge_bases_embedding_model ON knowledge_bases(embedding_model_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_bases_owner ON knowledge_bases(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_bases_is_public ON knowledge_bases(is_public);
    CREATE INDEX IF NOT EXISTS idx_translation_history_created_at ON translation_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_translation_history_user_id ON translation_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_model_prefs_user ON user_model_prefs(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_kb_prefs_user ON user_kb_prefs(user_id);
  `);

  console.log('Database initialized successfully');
}

// Close database connection
export function closeDatabase() {
  db.close();
}

// Helper function to run migrations
export function runMigrations() {
  // Future migrations can be added here
  console.log('All migrations completed');
}
