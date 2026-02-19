const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/queue.db');
const dbDir = path.dirname(dbPath);

let db = null;

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function initDatabase() {
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS fingerprints (
      id TEXT PRIMARY KEY,
      first_seen INTEGER NOT NULL,
      last_queue_attempt INTEGER,
      cooldown_expires INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'blocked')),
      username TEXT,
      github_id TEXT,
      github_username TEXT,
      github_avatar TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint_id TEXT NOT NULL,
      track_id TEXT,
      track_name TEXT,
      artist_name TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (fingerprint_id) REFERENCES fingerprints(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT UNIQUE NOT NULL,
      artist_id TEXT,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prequeue (
      id TEXT PRIMARY KEY,
      fingerprint_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      album_art TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'declined')),
      approved_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (fingerprint_id) REFERENCES fingerprints(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      fingerprint_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(track_id, fingerprint_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Initialize default config
  const defaultConfig = [
    { key: 'cooldown_duration', value: '300' },
    { key: 'songs_before_cooldown', value: '1' },
    { key: 'fingerprinting_enabled', value: 'true' },
    { key: 'url_input_enabled', value: 'true' },
    { key: 'search_ui_enabled', value: 'true' },
    { key: 'queueing_enabled', value: 'true' },
    { key: 'prequeue_enabled', value: 'false' },
    { key: 'admin_panel_url', value: '' },
    { key: 'admin_password', value: 'admin' },
    { key: 'user_password', value: '' },
    { key: 'require_username', value: 'false' },
    { key: 'max_song_duration', value: '0' },
    { key: 'ban_explicit', value: 'false' },
    { key: 'voting_enabled', value: 'false' },
    { key: 'aura_enabled', value: 'true' },
    { key: 'confetti_enabled', value: 'true' }
  ];

  const insertConfig = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
  for (const config of defaultConfig) {
    insertConfig.run(config.key, config.value);
  }

  console.log('Database initialized');
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  return db;
}

module.exports = { initDatabase, getDb };
