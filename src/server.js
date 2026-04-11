import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
config(); // no-op in production where env vars are injected by the platform
import { runPipeline } from './orchestrator.js';
import { SAMPLE_PRS } from './sample-prs.js';
import { fetchPRData } from './github.js';
import { saveReview, getHistory, getReviewById, setupHistory } from './history.js';
import { startOAuth, handleCallback, requireAuth } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, '../web')));

// ── Auth endpoints ────────────────────────────────────────────────────────

app.get('/auth/github', startOAuth);
app.get('/auth/github/callback', handleCallback);
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
app.get('/api/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.session.user);
});

// ── Sample PR endpoints ────────────────────────────────────────────────────

app.get('/api/samples', (_req, res) => {
  res.json(SAMPLE_PRS.map(({ id, title, description }) => ({ id, title, description })));
});

app.get('/api/samples/:id', (req, res) => {
  const sample = SAMPLE_PRS.find(s => s.id === req.params.id);
  if (!sample) return res.status(404).json({ error: 'Sample not found' });
  res.json(sample);
});

// ── GitHub PR fetch endpoint ───────────────────────────────────────────────

app.get('/api/fetch-pr', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query parameter is required' });

  try {
    const prData = await fetchPRData(url);
    res.json(prData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── History endpoints ─────────────────────────────────────────────────────

app.get('/api/history', async (_req, res) => {
  res.json(await getHistory());
});

app.get('/api/history/:id', async (req, res) => {
  const entry = await getReviewById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Review not found' });
  res.json(entry);
});

// ── Review pipeline endpoint (Server-Sent Events) ─────────────────────────

app.post('/api/review', requireAuth, async (req, res) => {
  const { title, description, files } = req.body;

  if (!title || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'title and at least one file are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await runPipeline(
      { title, description, files },
      (progress) => send({ type: 'progress', ...progress })
    );
    saveReview({
      title,
      url: req.body.url || null,
      verdict: result.final_review.verdict,
      result
    });
    send({ type: 'complete', result });
  } catch (err) {
    console.error('Pipeline error:', err);
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nAI Code Review Pipeline running at http://localhost:${PORT}\n`);
  setupHistory();
});
