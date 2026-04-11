import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id        TEXT        PRIMARY KEY,
      title     TEXT        NOT NULL,
      url       TEXT,
      verdict   TEXT,
      result    JSONB       NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default pool;
