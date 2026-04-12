/**
 * Retries an async function up to `retries` times with exponential backoff.
 * Does not retry on 4xx client errors (bad input — retrying won't help).
 *
 * @param {function} fn       - async function to call
 * @param {number}   retries  - max attempts after the first (default 3)
 * @param {number}   backoff  - initial wait in ms, doubles each attempt (default 1000)
 */
export async function withRetry(fn, retries = 3, backoff = 1000) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      // Don't retry client errors — they won't succeed on retry
      const status = err.status ?? err.statusCode;
      if (status && status >= 400 && status < 500) throw err;

      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}
