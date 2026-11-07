// Dashboard trip stats (moved out of Dashboard.jsx so they can be tested — Nov 7 2026).

/** "today", "yesterday", "3 days ago", "2 weeks ago", "4 months ago". */
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.max(0, Math.floor((now - t) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

/** Dashboard headline about the most recent plan (it's a plan, not a trip taken). */
export function lastPlanHeadline(iso, destination, now = Date.now()) {
  const when = timeAgo(iso, now);
  if (!when) return null;
  const place = String(destination || '').split(',')[0].trim() || 'your last trip';
  if (when === 'today') return `You planned ${place} today.`;
  if (when === 'yesterday') return `You planned ${place} yesterday.`;
  return `It's been ${when.replace(/ ago$/, '')} since you planned ${place}.`;
}

// Town or region → country, so "Hoi An" and "Hoi An, Vietnam" both count as Vietnam.
const CITY_TO_COUNTRY = {
  bali: 'Indonesia', ubud: 'Indonesia', lombok: 'Indonesia', flores: 'Indonesia', java: 'Indonesia', yogyakarta: 'Indonesia',
  goa: 'India', shimla: 'India', manali: 'India', bir: 'India', delhi: 'India', 'new delhi': 'India', mumbai: 'India',
  bangalore: 'India', kerala: 'India', kashmir: 'India', himachal: 'India', triund: 'India', coorg: 'India',
  rishikesh: 'India', udaipur: 'India', jaipur: 'India', munnar: 'India', ladakh: 'India', leh: 'India',
  kyoto: 'Japan', tokyo: 'Japan', osaka: 'Japan', hiroshima: 'Japan', takayama: 'Japan', kanazawa: 'Japan', nara: 'Japan',
  hanoi: 'Vietnam', 'hoi an': 'Vietnam', 'da nang': 'Vietnam', hue: 'Vietnam', sapa: 'Vietnam', 'ninh binh': 'Vietnam',
  'ho chi minh': 'Vietnam', saigon: 'Vietnam', 'ha giang': 'Vietnam', 'da lat': 'Vietnam', dalat: 'Vietnam',
  oaxaca: 'Mexico', 'mexico city': 'Mexico',
  bangkok: 'Thailand', 'chiang mai': 'Thailand', 'chiang rai': 'Thailand', phuket: 'Thailand', pai: 'Thailand', krabi: 'Thailand',
  ella: 'Sri Lanka', kandy: 'Sri Lanka', galle: 'Sri Lanka', sigiriya: 'Sri Lanka', colombo: 'Sri Lanka',
  kathmandu: 'Nepal', pokhara: 'Nepal', bhaktapur: 'Nepal',
  barcelona: 'Spain', madrid: 'Spain', seville: 'Spain', granada: 'Spain',
  amsterdam: 'Netherlands',
  rome: 'Italy', milan: 'Italy', florence: 'Italy', venice: 'Italy', dolomites: 'Italy', 'cinque terre': 'Italy', puglia: 'Italy',
  dubai: 'UAE', 'abu dhabi': 'UAE',
  singapore: 'Singapore',
  'hong kong': 'Hong Kong',
  lisbon: 'Portugal', porto: 'Portugal', madeira: 'Portugal', azores: 'Portugal',
  berlin: 'Germany', munich: 'Germany',
  paris: 'France', nice: 'France',
  prague: 'Czech Republic',
  budapest: 'Hungary',
  reykjavik: 'Iceland',
  tbilisi: 'Georgia', kutaisi: 'Georgia',
  marrakech: 'Morocco', casablanca: 'Morocco',
  petra: 'Jordan',
  muscat: 'Oman',
  ljubljana: 'Slovenia', bled: 'Slovenia',
  dubrovnik: 'Croatia', split: 'Croatia',
  sydney: 'Australia', melbourne: 'Australia', 'blue mountains': 'Australia', tasmania: 'Australia',
  queenstown: 'New Zealand', wanaka: 'New Zealand',
  'luang prabang': 'Laos', bukhara: 'Uzbekistan', samarkand: 'Uzbekistan', paro: 'Bhutan', thimphu: 'Bhutan',
  cusco: 'Peru', lima: 'Peru',
};

const KNOWN_COUNTRIES = new Set([
  'Australia', 'Austria', 'Bhutan', 'Cambodia', 'Canada', 'Chile', 'China', 'Croatia', 'Czech Republic', 'Denmark',
  'France', 'Georgia', 'Germany', 'Greece', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Ireland', 'Italy',
  'Japan', 'Jordan', 'Kenya', 'Laos', 'Malaysia', 'Mexico', 'Morocco', 'Nepal', 'Netherlands', 'New Zealand', 'Norway',
  'Oman', 'Peru', 'Philippines', 'Portugal', 'Scotland', 'Singapore', 'Slovenia', 'South Africa', 'South Korea', 'Spain',
  'Sri Lanka', 'Sweden', 'Switzerland', 'Taiwan', 'Tanzania', 'Thailand', 'Turkey', 'UAE', 'UK', 'United Kingdom', 'USA',
  'United States', 'Uzbekistan', 'Vietnam',
]);
const COUNTRY_BY_LOWER = new Map([...KNOWN_COUNTRIES].map(c => [c.toLowerCase(), c]));

/**
 * Country of a destination as typed ("Hoi An", "Kyoto, Japan", "Vietnam", "sydney").
 * Unknown single places return null instead of being counted as a "country".
 */
export function extractCountry(destination) {
  if (!destination) return null;
  const parts = String(destination).split(',').map(s => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (COUNTRY_BY_LOWER.has(last.toLowerCase())) return COUNTRY_BY_LOWER.get(last.toLowerCase());
  const lower = String(destination).toLowerCase();
  for (const [city, country] of Object.entries(CITY_TO_COUNTRY)) {
    if (new RegExp(`(^|[^a-z])${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lower)) return country;
  }
  // "Somewhere, Some Country" we don't know yet: trust the part after the comma.
  return parts.length > 1 ? last.replace(/\b\w/g, ch => ch.toUpperCase()) : null;
}
