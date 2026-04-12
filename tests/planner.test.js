import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJSON } from '../src/agents/planner.js';

test('parses a plain JSON string', () => {
  const input = '{"summary": "adds login", "concerns": ["security"]}';
  const result = parseJSON(input);
  assert.equal(result.summary, 'adds login');
  assert.deepEqual(result.concerns, ['security']);
});

test('strips markdown json code fences', () => {
  const input = '```json\n{"summary": "refactor", "concerns": []}\n```';
  const result = parseJSON(input);
  assert.equal(result.summary, 'refactor');
});

test('strips plain code fences', () => {
  const input = '```\n{"summary": "fix bug", "concerns": ["logic"]}\n```';
  const result = parseJSON(input);
  assert.equal(result.summary, 'fix bug');
});

test('throws a user-friendly error on invalid JSON', () => {
  assert.throws(
    () => parseJSON('this is not json'),
    { message: 'The planner agent returned an incomplete response. Please try again.' }
  );
});

test('throws on empty string', () => {
  assert.throws(
    () => parseJSON(''),
    { message: 'The planner agent returned an incomplete response. Please try again.' }
  );
});
