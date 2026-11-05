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

/** Text of the first text block, or '' */
function firstText(data) {
  const block = (data?.content || []).find(b => b?.type === 'text' || typeof b?.text === 'string');
  return block?.text || '';
}

module.exports = { createMessage, firstText, ClaudeError, RETRYABLE_STATUS };
