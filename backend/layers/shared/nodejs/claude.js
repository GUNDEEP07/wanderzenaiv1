'use strict';

/**
 * Claude Messages API call with a timeout and retries.
 *
 * Used by the handlers that call the API with raw fetch (itinerary-gen, form-handler
 * /preview). The SDK-based handlers (recommendations, destination-insights) already get
 * retries from @anthropic-ai/sdk.
 *
 * Retries: network errors, timeouts, 408, 409, 429, 5xx and 529 (overloaded), with
 * exponential backoff plus jitter, honouring a retry-after header when present.
 * Other 4xx (bad request, auth, not found) fail immediately — retrying can't fix them.
 */

/**
 * Model IDs in one place, overridable per deploy (template.yaml ClaudeModelFast /
 * ClaudeModelStrong → CLAUDE_MODEL_FAST / CLAUDE_MODEL_STRONG).
 *   strong — writes the itinerary (overview, day batches, Q3 repairs)
 *   fast   — interactive calls: preview, chat, recommendations, insights
 *
 * Claude 5.x models (Opus 5.5, Haiku 5.5) always use adaptive thinking:
 *   - a response can start with thinking blocks → read text via firstText(), never content[0]
 *   - max_tokens caps thinking + text together → callers size it with maxTokensFor()
 *   - temperature / top_p / top_k and a prefilled assistant turn are rejected → never send them
 *   - depth is set with output_config.effort (low | medium | high | xhigh | max)
 * Docs: https://platform.claude.com/docs/en/models/opus-5-5/migration-guide
 */
const MODELS = Object.freeze({
  fast: process.env.CLAUDE_MODEL_FAST || 'claude-haiku-5-5',
  strong: process.env.CLAUDE_MODEL_STRONG || 'claude-opus-5-5',
});

const EFFORT_LEVELS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/** True for models that take output_config.effort and think adaptively (Claude 5.x and later). */
function supportsEffort(model) {
  return /^claude-(opus|sonnet|haiku)-([5-9]|\d{2,})(\b|-)/.test(String(model || '')) ||
    /^claude-(fable|mythos)-/.test(String(model || ''));
}

/**
 * Request body with an effort level added when the model supports it. Older models
 * (e.g. a rollback to Haiku 4.5 via the template parameter) get the body unchanged,
 * so they never see a parameter they would reject.
 * @param {object} body Messages API request body
 * @param {'low'|'medium'|'high'|'xhigh'|'max'} effort
 */
function withEffort(body, effort) {
  if (!supportsEffort(body.model) || !EFFORT_LEVELS.has(effort)) return body;
  return { ...body, output_config: { ...(body.output_config || {}), effort } };
}

/**
 * max_tokens for a call that needs about `textTokens` of visible output. On thinking
 * models the limit also covers thinking, so leave headroom (thinking tokens are billed
 * as output only when used, so a higher cap costs nothing by itself).
 */
function maxTokensFor(model, textTokens, { thinkingHeadroom = 4000, cap = 64000 } = {}) {
  if (!supportsEffort(model)) return textTokens;
  return Math.min(Math.round(textTokens * 1.5) + thinkingHeadroom, cap);
}

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

class ClaudeError extends Error {
  constructor(message, { status = null, retryable = false, attempts = 1 } = {}) {
    super(message);
    this.name = 'ClaudeError';
    this.status = status;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function backoffMs(attempt, retryAfterHeader, { baseMs, maxMs }) {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, maxMs);
  const exp = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
  return Math.round(exp / 2 + Math.random() * (exp / 2)); // "equal jitter"
}

/**
 * @param {object} body Messages API request body (model, max_tokens, system, messages, …)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=60000] per attempt
 * @param {number} [opts.maxAttempts=3]
 * @param {number} [opts.baseDelayMs=1000]
 * @param {number} [opts.maxDelayMs=15000]
 * @param {(info: object) => void} [opts.onRetry] called before each retry (for logging)
 * @param {typeof fetch} [opts.fetchImpl] for tests
 * @returns {Promise<object>} parsed API response
 * @throws {ClaudeError}
 */
async function createMessage(body, opts = {}) {
  const {
    timeoutMs = 60000, maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 15000,
    onRetry = () => {}, fetchImpl = fetch,
  } = opts;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new ClaudeError('CLAUDE_API_KEY is not configured');

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let retryAfter = null;
    try {
      const res = await fetchImpl(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const data = await res.json();
        if (!Array.isArray(data?.content)) throw new ClaudeError('Claude response had no content', { status: res.status, attempts: attempt });
        return data;
      }
      const text = await res.text().catch(() => '');
      retryAfter = res.headers?.get?.('retry-after') ?? null;
      const retryable = RETRYABLE_STATUS.has(res.status);
      lastError = new ClaudeError(`Claude API ${res.status}: ${text.slice(0, 300)}`, { status: res.status, retryable, attempts: attempt });
      if (!retryable) throw lastError;
    } catch (err) {
      if (err instanceof ClaudeError && !err.retryable) throw err;
      if (!(err instanceof ClaudeError)) {
        // fetch rejects on network failure and on AbortSignal.timeout (TimeoutError).
        const kind = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timed out' : 'network error';
        lastError = new ClaudeError(`Claude API ${kind}: ${err.message}`, { retryable: true, attempts: attempt });
      } else {
        lastError = err;
      }
    }
    if (attempt < maxAttempts) {
      const delay = backoffMs(attempt, retryAfter, { baseMs: baseDelayMs, maxMs: maxDelayMs });
      onRetry({ attempt, delayMs: delay, status: lastError.status, error: lastError.message });
      await sleep(delay);
    }
  }
  lastError.attempts = maxAttempts;
  throw lastError;
}

/**
 * All text blocks of a response joined, or ''. Thinking blocks (which may come first,
 * and are empty at the default display setting) are skipped.
 */
function firstText(data) {
  return (data?.content || [])
    .filter(b => b?.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('');
}

module.exports = {
  MODELS, createMessage, firstText, withEffort, maxTokensFor, supportsEffort,
  ClaudeError, RETRYABLE_STATUS,
};
