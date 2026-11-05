'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { createMessage, firstText, ClaudeError } = require(path.join(__dirname, '../../layers/shared/nodejs/claude.js'));

process.env.CLAUDE_API_KEY = 'sk-test';
const FAST = { baseDelayMs: 1, maxDelayMs: 5 };

const okResponse = (text = 'hello') => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } }),
});
const errResponse = (status, headers = {}) => ({
  ok: false, status, headers: new Map(Object.entries(headers)), text: async () => `error ${status}`,
});

function scripted(...steps) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return step;
  };
  return { calls, fetchImpl };
}

test('returns the response and sends the right headers and body', async () => {
  const { calls, fetchImpl } = scripted(okResponse('hi'));
  const data = await createMessage({ model: 'm', max_tokens: 10, messages: [] }, { fetchImpl, ...FAST });
  assert.equal(firstText(data), 'hi');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-api-key'], 'sk-test');
  assert.equal(calls[0].init.headers['anthropic-version'], '2023-06-01');
  assert.equal(JSON.parse(calls[0].init.body).model, 'm');
  assert.ok(calls[0].init.signal, 'a timeout signal is attached');
});

for (const status of [429, 500, 529]) {
  test(`retries on ${status} then succeeds`, async () => {
    const retries = [];
    const { calls, fetchImpl } = scripted(errResponse(status), okResponse());
    await createMessage({}, { fetchImpl, ...FAST, onRetry: (i) => retries.push(i) });
    assert.equal(calls.length, 2);
    assert.equal(retries[0].status, status);
  });
}

test('retries on network errors and timeouts', async () => {
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  const { calls, fetchImpl } = scripted(new TypeError('fetch failed'), timeout, okResponse());
  await createMessage({}, { fetchImpl, ...FAST });
  assert.equal(calls.length, 3);
});

test('does not retry a 400 or 401', async () => {
  for (const status of [400, 401]) {
    const { calls, fetchImpl } = scripted(errResponse(status), okResponse());
    await assert.rejects(createMessage({}, { fetchImpl, ...FAST }), (e) => e instanceof ClaudeError && e.status === status && !e.retryable);
    assert.equal(calls.length, 1);
  }
});

test('gives up after maxAttempts with the last error', async () => {
  const { calls, fetchImpl } = scripted(errResponse(529));
  await assert.rejects(createMessage({}, { fetchImpl, ...FAST, maxAttempts: 3 }), (e) => e.status === 529 && e.attempts === 3);
  assert.equal(calls.length, 3);
});

test('honours retry-after (capped by maxDelayMs)', async () => {
  const retries = [];
  const { fetchImpl } = scripted(errResponse(429, { 'retry-after': '1' }), okResponse());
  await createMessage({}, { fetchImpl, baseDelayMs: 1, maxDelayMs: 20, onRetry: (i) => retries.push(i) });
  assert.equal(retries[0].delayMs, 20);
});

test('fails clearly without an API key', async () => {
  const saved = process.env.CLAUDE_API_KEY;
  delete process.env.CLAUDE_API_KEY;
  try {
    await assert.rejects(createMessage({}, { fetchImpl: async () => okResponse() }), /not configured/);
  } finally {
    process.env.CLAUDE_API_KEY = saved;
  }
});

test('firstText tolerates odd shapes', () => {
  assert.equal(firstText({ content: [{ type: 'tool_use' }, { type: 'text', text: 'x' }] }), 'x');
  assert.equal(firstText({}), '');
  assert.equal(firstText(null), '');
});
