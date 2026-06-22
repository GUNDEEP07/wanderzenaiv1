/**
 * Retry helper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Configuration
 * @param {number} options.maxRetries - Max attempts (default: 3)
 * @param {number} options.delayMs - Initial delay in ms (default: 500)
 * @returns {Promise} Result from successful call or throws after all retries fail
 */
export async function fetchWithRetry(fn, { maxRetries = 3, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();

      // Validate response is not empty
      if (result === null || result === undefined) {
        throw new Error('Empty response from API');
      }

      // Success on this attempt
      if (attempt > 0) {
        console.debug(`Retry succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (err) {
      lastError = err;

      // Last attempt failed
      if (attempt === maxRetries - 1) {
        console.error(`Failed after ${maxRetries} attempts:`, err.message);
        throw err;
      }

      // Calculate exponential backoff: 500ms → 1000ms → 2000ms
      const delayWithBackoff = delayMs * Math.pow(2, attempt);
      console.debug(`Retry attempt ${attempt + 1} failed, waiting ${delayWithBackoff}ms...`);

      // Wait before retrying
      await new Promise(r => setTimeout(r, delayWithBackoff));
    }
  }

  throw lastError || new Error('Retry failed');
}
