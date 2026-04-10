import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a code review planner. Your job is to analyze a pull request and create a structured plan for the review agents that come after you.

Given a PR's title, description, and changed files, determine:
- What the PR is trying to accomplish
- Which concern areas are relevant (security, logic, performance, style, testing)
- Which files are highest priority to review
- Any context that will help reviewers understand the intent

Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export async function planReview({ title, description, files }) {
  const fileList = files.map(f => `- ${f.name} (${f.language || 'unknown'})`).join('\n');
  const diffs = files.map(f => `=== ${f.name} ===\n${f.diff}`).join('\n\n');

  const prompt = `PR Title: ${title}
PR Description: ${description || 'No description provided.'}

Changed files:
${fileList}

Diffs:
${diffs}

Return a JSON object with this exact shape:
{
  "summary": "one sentence describing what this PR does",
  "concerns": ["security", "logic", "performance", "style", "testing"],
  "files": [
    { "name": "filename", "priority": "high|medium|low", "reason": "why this file matters" }
  ],
  "skip_files": ["lockfiles, auto-generated files, etc"],
  "context": "any important context reviewers should know"
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  return parseJSON(response.content[0].text);
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}
