import { randomUUID } from 'crypto';
import pool, { initDb } from './db.js';

await initDb();

export async function saveReview({ title, url, verdict, result }) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO reviews (id, title, url, verdict, result) VALUES ($1, $2, $3, $4, $5)`,
    [id, title, url || null, verdict, result]
  );
}

export async function getHistory() {
  const { rows } = await pool.query(
    `SELECT id, title, url, verdict, timestamp FROM reviews ORDER BY timestamp DESC LIMIT 50`
  );
  return rows;
}

export async function getReviewById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}
