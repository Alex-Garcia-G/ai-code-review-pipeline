import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../config.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a security-focused code auditor. Your job is to find security vulnerabilities in code changes.

Look for:
- Injection vulnerabilities (SQL, command, LDAP, XPath)
- Cross-site scripting (XSS)
- Hardcoded secrets, API keys, passwords, tokens
- Authentication and authorization flaws
- Sensitive data exposure (returning too much data, logging secrets)
- Cryptographic weaknesses (weak algorithms, bad key management)
- Path traversal vulnerabilities
- Missing input validation or sanitization
- Race conditions in sensitive operations

A missed critical vulnerability can have severe consequences. Be thorough.
Always respond with valid JSON only. No markdown, no explanation outside the JSON.`;

export async function securityScan({ file }) {
  const prompt = `File: ${file.name}

Diff:
${file.diff}

Scan for security vulnerabilities. Return a JSON object with this exact shape:
{
  "file": "${file.name}",
  "has_issues": true,
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "type": "e.g. SQL Injection, Hardcoded Secret, XSS",
      "description": "what the vulnerability is and why it's dangerous",
      "line_hint": "where in the code (e.g. 'in the db.query() call')",
      "recommendation": "specific fix"
    }
  ]
}`;

  const response = await client.messages.create({
    model: MODELS.security,
    max_tokens: 4000,
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
    throw new Error('The security agent returned an incomplete response. Please try again.');
  }
}
