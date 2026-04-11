# ai-code-review-pipeline

Multi-agent AI system that orchestrates specialized Claude agents to review pull requests.

## Stack

- **Runtime:** Node.js (ES modules)
- **Server:** Express
- **AI:** Anthropic Claude API (`@anthropic-ai/sdk`)
- **Frontend:** Vanilla HTML/CSS/JS (no framework)

## Structure

- `src/server.js` — Express server, serves static files and `/api/` routes
- `src/orchestrator.js` — Coordinates all agents, streams progress via SSE
- `src/agents/planner.js` — Analyzes PR and produces a review plan
- `src/agents/reviewer.js` — Reviews code quality and logic per file
- `src/agents/security.js` — Scans for security vulnerabilities per file
- `src/agents/synthesizer.js` — Combines all findings into a final review
- `src/sample-prs.js` — Demo PR data (includes a vulnerable login PR)
- `web/` — Frontend: single page app that streams live pipeline progress

## Running

```bash
cp .env.example .env
# add your ANTHROPIC_API_KEY to .env
npm install
npm run dev
# open http://localhost:3000
```

## Architecture

The pipeline runs in 3 stages:
1. **Planner** — reads PR metadata + file list, decides what to focus on
2. **Reviewer + Security** — run in parallel per file (concurrent agent calls)
3. **Synthesizer** — merges all outputs into one final review

Agent communication is JSON. Each agent has a strict system prompt and returns structured data.

## Rules

- Always commit code changes to GitHub — every feature, fix, or refactor gets a commit with a conventional commit message (`feat:`, `fix:`, `chore:`, etc.).
- Only commit once the fix is confirmed working — do not commit speculatively. Wait for the user to verify before committing.
