import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runPipeline } from './orchestrator.js';
import { SAMPLE_PRS } from './sample-prs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, '../web')));

// ── Sample PR endpoints ────────────────────────────────────────────────────

app.get('/api/samples', (_req, res) => {
  res.json(SAMPLE_PRS.map(({ id, title, description }) => ({ id, title, description })));
});

app.get('/api/samples/:id', (req, res) => {
  const sample = SAMPLE_PRS.find(s => s.id === req.params.id);
  if (!sample) return res.status(404).json({ error: 'Sample not found' });
  res.json(sample);
});

// ── Review pipeline endpoint (Server-Sent Events) ─────────────────────────

app.post('/api/review', async (req, res) => {
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
});
