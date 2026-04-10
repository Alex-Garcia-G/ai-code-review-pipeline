import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../config.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a senior software engineer writing a final code review. You have received analysis from multiple specialized agents (a code reviewer and a security scanner).

Your job is to synthesize their findings into a single, professional, actionable review.

Write like a thoughtful senior engineer: direct, constructive, specific, and fair.
- Lead with critical and security issues — these are blockers
- Consolidate related feedback, don't repeat the same point twice
- Acknowledge what was done well — good engineers notice both
- Match your tone to your verdict: firm if requesting changes, warm if approving

Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export async function synthesizeReview({ pr_info, reviewer_outputs, security_outputs }) {
  const prompt = `PR: "${pr_info.title}"
Summary: ${pr_info.summary}

Code Review Findings:
${JSON.stringify(reviewer_outputs, null, 2)}

Security Scan Findings:
${JSON.stringify(security_outputs, null, 2)}

Synthesize all findings into a final review. Return a JSON object with this exact shape:
{
  "verdict": "APPROVE|REQUEST_CHANGES|COMMENT",
  "summary": "2-3 sentence overview of the PR and the review",
  "critical_issues": [
    { "title": "short title", "description": "what the issue is", "recommendation": "how to fix it" }
  ],
  "suggestions": [
    { "title": "short title", "description": "non-blocking improvement", "recommendation": "what to change" }
  ],
  "positives": ["things done well — be specific"],
  "final_comment": "closing paragraph, tone should match the verdict"
}`;

  const response = await client.messages.create({
    model: MODELS.synthesizer,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  return parseJSON(response.content[0].text);
}

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('The synthesizer agent returned an incomplete response. This usually means the review was very large. Please try again.');
  }
}
