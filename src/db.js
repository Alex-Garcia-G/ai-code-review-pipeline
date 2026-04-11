import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT        PRIMARY KEY,
      username   TEXT        NOT NULL,
      name       TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id        TEXT        PRIMARY KEY,
      user_id   TEXT,
      title     TEXT        NOT NULL,
      url       TEXT,
      verdict   TEXT,
      result    JSONB       NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add user_id to existing tables that were created before this column existed
  await pool.query(`
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id TEXT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id    TEXT        PRIMARY KEY REFERENCES users(id),
      strictness TEXT        DEFAULT 'balanced',
      focus      TEXT        DEFAULT 'balanced',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default pool;
