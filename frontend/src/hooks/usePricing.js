import { useEffect, useState } from 'react';
import { fetchPricing } from '../api/pricing';

/** Plans from GET /pricing: { trip, pass, loading, error }. One request per page view. */
export function usePricing() {
  const [state, setState] = useState({ trip: null, pass: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    fetchPricing()
      .then(d => {
        if (!alive) return;
        const by = Object.fromEntries((d?.plans || []).map(p => [p.plan, p]));
        setState({ trip: by.trip || null, pass: by.pass || null, loading: false, error: null });
      })
      .catch(err => { if (alive) setState({ trip: null, pass: null, loading: false, error: err.message }); });
    return () => { alive = false; };
  }, []);
  return state;
}

/** "6 trips · use within 12 months" from a pass's validDays. */
export function passTerm(pass) {
  if (!pass) return '';
  const d = pass.validDays || 365;
  const span = d % 365 === 0 ? `${d / 365 === 1 ? '12 months' : `${d / 365} years`}` : d % 30 === 0 ? `${d / 30} months` : `${d} days`;
  return `${pass.trips} trips · use within ${span}`;
}
