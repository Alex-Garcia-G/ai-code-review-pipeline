import { randomUUID } from 'crypto';
import pool, { initDb } from './db.js';

try {
  await initDb();
} catch (err) {
  console.error('Database not available — history will be disabled:', err.message);
}

export async function saveReview({ title, url, verdict, result }) {
  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO reviews (id, title, url, verdict, result) VALUES ($1, $2, $3, $4, $5)`,
      [id, title, url || null, verdict, result]
    );
  } catch (err) {
    console.error('Could not save review to database:', err.message);
  }
}

export async function getHistory() {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, url, verdict, timestamp FROM reviews ORDER BY timestamp DESC LIMIT 50`
    );
    return rows;
  } catch {
    return [];
  }
}

export async function getReviewById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM reviews WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}
