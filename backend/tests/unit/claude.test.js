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

test('firstText skips a leading thinking block (current models think adaptively)', () => {
  const data = { content: [{ type: 'thinking', thinking: 'planning…', signature: 'x' }, { type: 'text', text: '{"days":[]}' }] };
  assert.equal(firstText(data), '{"days":[]}');
});

test('firstText joins several text blocks and ignores thinking between them', () => {
  const data = { content: [
    { type: 'thinking', thinking: '', signature: 's' },
    { type: 'text', text: '{"a":' },
    { type: 'thinking', thinking: '', signature: 't' },
    { type: 'text', text: '1}' },
  ] };
  assert.equal(firstText(data), '{"a":1}');
});

const claude = require(path.join(__dirname, '../../layers/shared/nodejs/claude.js'));

test('MODELS: Opus 5.5 writes itineraries, Haiku 5.5 handles quick calls (unless overridden)', () => {
  if (!process.env.CLAUDE_MODEL_FAST) assert.equal(claude.MODELS.fast, 'claude-haiku-5-5');
  if (!process.env.CLAUDE_MODEL_STRONG) assert.equal(claude.MODELS.strong, 'claude-opus-5-5');
});

test('supportsEffort: Claude 5.x and later only', () => {
  for (const m of ['claude-opus-5-5', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5', 'claude-fable-5-1']) {
    assert.equal(claude.supportsEffort(m), true, m);
  }
  for (const m of ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-3-5-sonnet-20241022', '', undefined]) {
    assert.equal(claude.supportsEffort(m), false, String(m));
  }
});

test('withEffort adds output_config.effort only for models that accept it', () => {
  const body = { model: 'claude-opus-5-5', max_tokens: 10, messages: [] };
  assert.deepEqual(claude.withEffort(body, 'low').output_config, { effort: 'low' });
  assert.equal(body.output_config, undefined, 'input body is not mutated');
  const old = { model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [] };
  assert.equal(claude.withEffort(old, 'low'), old);
  assert.equal(claude.withEffort(body, 'turbo'), body, 'unknown effort ignored');
});

test('maxTokensFor leaves thinking headroom on 5.x models, unchanged on older ones', () => {
  assert.equal(claude.maxTokensFor('claude-haiku-4-5-20251001', 1024), 1024);
  assert.equal(claude.maxTokensFor('claude-opus-5-5', 5800), Math.round(5800 * 1.5) + 4000);
  assert.equal(claude.maxTokensFor('claude-opus-5-5', 1e6), 64000, 'capped');
  assert.equal(claude.maxTokensFor('claude-haiku-5-5', 256, { thinkingHeadroom: 1500 }), 384 + 1500);
});

test('no request body ever carries sampling params (rejected by 5.x models)', async () => {
  let sent;
  process.env.CLAUDE_API_KEY = 'k';
  await claude.createMessage(claude.withEffort({ model: 'claude-opus-5-5', max_tokens: 5, messages: [] }, 'medium'), {
    fetchImpl: async (_u, init) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'x' }] }) }; },
  });
  for (const k of ['temperature', 'top_p', 'top_k', 'thinking']) assert.equal(k in sent, false, k);
  assert.deepEqual(sent.output_config, { effort: 'medium' });
});
