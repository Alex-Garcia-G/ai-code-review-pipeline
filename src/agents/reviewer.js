import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert code reviewer with deep experience across many languages and systems.

For a given file diff, review for:
- Logic correctness (bugs, edge cases, wrong assumptions)
- Code quality (readability, naming, maintainability)
- Best practices and anti-patterns
- Missing error handling or test coverage

Be specific and actionable. Reference the actual code (function names, variable names) in your comments.
Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export async function reviewFile({ file, concerns, context }) {
  const prompt = `File: ${file.name}
Context: ${context || 'Standard review'}
Focus areas: ${concerns.join(', ')}

Diff:
${file.diff}

Return a JSON object with this exact shape:
{
  "file": "${file.name}",
  "verdict": "approve|needs_changes|nitpick",
  "summary": "one sentence describing what changed in this file",
  "comments": [
    {
      "line_hint": "describe where in the code (e.g. 'in the router.post handler')",
      "severity": "critical|major|minor|nit",
      "message": "specific, actionable feedback"
    }
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  return parseJSON(response.content[0].text);
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}
