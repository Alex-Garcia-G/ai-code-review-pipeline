import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const HISTORY_FILE = join(DATA_DIR, 'reviews.json');
const MAX_ENTRIES = 50;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDataDir();
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(entries) {
  ensureDataDir();
  writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

export function saveReview({ title, url, verdict, result }) {
  const entries = readAll();
  entries.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    title,
    url: url || null,
    verdict,
    result
  });
  writeAll(entries.slice(0, MAX_ENTRIES));
}

export function getHistory() {
  return readAll().map(({ id, timestamp, title, url, verdict }) => ({
    id, timestamp, title, url, verdict
  }));
}

export function getReviewById(id) {
  return readAll().find(e => e.id === id) || null;
}
