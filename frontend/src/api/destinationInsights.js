const API_URL = import.meta.env.VITE_API_URL;

/**
 * GET /destination-insights. Cached server-side per destination + travel month (+ currency and
 * home city when asked for cost estimates). `opts.currency` adds `estimates` (stays per night,
 * and return flights when `opts.from` is set) in that currency.
 */
export async function fetchDestinationInsights(destination, travelStyles, startDate, endDate, opts = {}) {
  if (!destination || !startDate || !endDate) return null;

  const params = new URLSearchParams({
    destination,
    travelStyles: Array.isArray(travelStyles) ? travelStyles.join(',') : '',
    startDate,
    endDate,
  });
  if (opts.currency) params.set('currency', opts.currency);
  if (opts.from) params.set('from', String(opts.from).slice(0, 80));

  const response = await fetch(`${API_URL}/destination-insights?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Destination insights API error: ${response.status}`);
  }

  const data = await response.json();
  return data.insights || null;
}
