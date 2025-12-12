// AIDEV-NOTE: Central monotonic clock helper. Use this for durations/latency metrics.
// Uses `performance.now()` when available (monotonic, high resolution), falling back to Date.now().

function nowMonotonicMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}


export { nowMonotonicMs };
