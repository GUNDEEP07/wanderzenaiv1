/**
 * Pure helpers for the trip page ("On the road" view): trip dates, what's next today,
 * money, budget by day and map links. No React, so they are unit-tested directly.
 */

export const PERIODS = [
  { key: 'morningActivity', label: 'Morning', fallback: 9 * 60 },
  { key: 'afternoonActivity', label: 'Afternoon', fallback: 14 * 60 },
  { key: 'eveningActivity', label: 'Evening', fallback: 19 * 60 },
];

/** First number in a cost value ("15", 15, "A$15–20" → 15); 0 when there is none. */
export function toAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : 0;
  const m = /\d+(?:[.,]\d+)?/.exec(String(v ?? '').replace(/,(?=\d{3}\b)/g, ''));
  return m ? Number(m[0].replace(',', '.')) : 0;
}

/** "A$1,200" / "€45" / "$30" — whole units, the trip's own currency. */
export function formatMoney(amount, currency) {
  const n = toAmount(amount);
  if (!n) return '';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString('en-US')} ${currency || ''}`.trim();
  }
}

/** "07:30", "7:30 am", "9am", "19h00" → minutes after midnight; null when there is no clock time. */
export function parseTime(text) {
  for (const m of String(text || '').matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/gi)) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = (m[3] || '').toLowerCase().replace(/\./g, '');
    if (!m[2] && !ap) continue; // a bare number ("2 hours", "Day 3") is not a time
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) continue;
    return h * 60 + min;
  }
  return null;
}

/** Local calendar date (YYYY-MM-DD) → Date at local midnight; null if invalid. */
export function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The date of day n (1-based) of a trip starting on travelDate. */
export function dayDate(travelDate, n) {
  const start = parseIsoDate(travelDate);
  if (!start || !n) return null;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + (n - 1));
}

/** Which day of the trip "now" is (1-based), or null when the trip isn't on today. */
export function todayDayNumber(travelDate, days, now = new Date()) {
  const start = parseIsoDate(travelDate);
  if (!start || !days) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - start) / 86400000);
  return diff >= 0 && diff < days ? diff + 1 : null;
}

/** "Wed 18 Nov" */
export function shortDate(d) {
  return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
}

/** The day's stops in time order: the three activities, then food and the hidden gem. */
export function dayStops(day) {
  if (!day) return [];
  const stops = PERIODS.filter(p => day[p.key]).map(p => {
    const act = day[p.key];
    const t = parseTime(act.time);
    return {
      id: p.key, kind: 'activity', period: p.label, act,
      minutes: t ?? p.fallback, timeLabel: act.time || p.label,
      title: act.activity || act.location || p.label,
      place: act.venueName || act.location || act.activity || '',
    };
  });
  if (day.localEats?.name) {
    stops.push({ id: 'localEats', kind: 'eat', period: 'Eat', minutes: null, timeLabel: 'Eat', title: day.localEats.name, place: day.localEats.venueName || day.localEats.name, eats: day.localEats });
  }
  if (day.hiddenGem) stops.push({ id: 'hiddenGem', kind: 'gem', period: 'Hidden gem', minutes: null, timeLabel: 'Gem', title: day.hiddenGem });
  return stops;
}

/** The first activity today that hasn't started more than 30 minutes ago and isn't marked done. */
export function upNext(stops, now = new Date(), done = new Set()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  return stops.find(s => s.kind === 'activity' && !done.has(s.id) && s.minutes + 30 >= mins) || null;
}

/** Google Maps directions to a place (name + base + country narrows it down). */
export function directionsUrl(place, base, destination) {
  const seen = new Set();
  const q = [place, base, destination].map(x => String(x || '').trim()).filter(x => {
    const k = x.toLowerCase();
    if (!x || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q || 'map')}`;
}

/** Per-day costs from what the generator returns; mirrors the PDF's "Budget by day". */
export function budgetRows(itinerary) {
  return (itinerary?.days || []).map(d => {
    const acts = PERIODS.reduce((s, p) => s + (d[p.key] && !d[p.key].isFree ? toAmount(d[p.key].cost) : 0), 0);
    const food = toAmount(d.localEats?.cost);
    const total = Math.max(toAmount(d.dailyCost), acts + food);
    return { dayNumber: d.dayNumber, base: d.base || '', acts, food, other: total - acts - food, total };
  });
}

/** Days per route base, with the stay suggested for it: [{ name, from, to, stay, transferIn }]. */
export function routeStops(itinerary) {
  const bases = itinerary?.route?.bases || [];
  let day = 1;
  return bases.map(b => {
    const from = day;
    day += b.days || 0;
    const stay = (itinerary.stays || []).find(s => String(s.base || '').toLowerCase() === String(b.name || '').toLowerCase()) || null;
    return { name: b.name, country: b.country, from, to: day - 1, stay, transferIn: b.transferIn || null };
  });
}
