import guides from '../../data/guides.json';
import { CURATED_COUNTRIES } from '../../components/plantrip/WhoIsTravelling';

export const GUIDES = guides;
export const guideBySlug = (slug = '') => guides.find((g) => g.slug === String(slug).toLowerCase()) || null;
export const guidePath = (g) => `/guides/${g.slug}`;

/** Planner prefill for "Plan this route": the country as a whole-country pick, and the days. */
export function planPrefill(guide, route) {
  const c = CURATED_COUNTRIES.find((x) => x.name === guide.name);
  const first = route?.stops?.[0];
  return {
    startStep: 0,
    prefill: {
      destinations: [{ name: guide.name, country: guide.name, lat: c?.lat ?? first?.lat ?? 0, lng: c?.lng ?? first?.lng ?? 0, isCountry: true }],
      ...(route ? { days: route.days } : {}),
    },
  };
}
