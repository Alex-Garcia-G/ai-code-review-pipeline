import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../src/utils.js';

test('succeeds on first attempt', async () => {
  let calls = 0;
  const result = await withRetry(() => { calls++; return 'ok'; });
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
});

test('retries on transient error and eventually succeeds', async () => {
  let calls = 0;
  const result = await withRetry(() => {
    calls++;
    if (calls < 3) throw new Error('transient');
    return 'recovered';
  }, 3, 0);
  assert.equal(result, 'recovered');
  assert.equal(calls, 3);
});

test('throws after exhausting all retries', async () => {
  let calls = 0;
  await assert.rejects(
    () => withRetry(() => { calls++; throw new Error('always fails'); }, 2, 0),
    { message: 'always fails' }
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});

test('does not retry 4xx client errors', async () => {
  let calls = 0;
  const clientError = Object.assign(new Error('bad request'), { status: 400 });
  await assert.rejects(
    () => withRetry(() => { calls++; throw clientError; }, 3, 0),
    { message: 'bad request' }
  );
  assert.equal(calls, 1); // no retries on client errors
});

test('retries on 5xx server errors', async () => {
  let calls = 0;
  const serverError = Object.assign(new Error('overloaded'), { status: 529 });
  await assert.rejects(
    () => withRetry(() => { calls++; throw serverError; }, 2, 0),
    { message: 'overloaded' }
  );
  assert.equal(calls, 3); // retries 5xx
});

test('returns value from successful retry', async () => {
  let calls = 0;
  const result = await withRetry(() => {
    calls++;
    if (calls === 1) throw new Error('first attempt failed');
    return 42;
  }, 1, 0);
  assert.equal(result, 42);
});
