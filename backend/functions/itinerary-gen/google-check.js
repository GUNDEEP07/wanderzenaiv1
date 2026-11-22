'use strict';

/**
 * Check every named place in a written trip against Google Places (Gundeep, Nov 22 2026:
 * "check with Google first"). For each activity and food stop:
 *   - Google finds it, it's open and passes the quality bar → keep it, remember its placeId.
 *   - not found (often an invented place), closed, or under the bar → swap in the best Google
 *     place of the same kind near that day's base that the trip doesn't already use.
 *   - no good swap → keep the text, mark it `unverified`.
 * Google's terms allow storing only place IDs, so that is all we add to the itinerary (plus our
 * own audit of what changed). Never fails a generation: Google trouble just skips the check.
 */

const gp = require('/opt/nodejs/google-places');

const PERIODS = ['morningActivity', 'afternoonActivity', 'eveningActivity'];
const CONCURRENCY = 6;
const MAX_CHECKS = 30;

// Names that aren't a single real place (the generator sometimes writes these as a location).
const GENERIC = /^(your |the )?(hotel|accommodation|homestay|guesthouse|stay|lodging|town( centre| center)?|city centre|old town|downtown|airport|bus station|train station|free time|rest|check.?in|check.?out|various|local (market|restaurant|cafe)s?)$/i;

function slotsOf(days) {
  const out = [];
  for (const d of days || []) {
    for (const p of PERIODS) {
      const a = d?.[p];
      const name = a && (a.venueName || a.location);
      if (name) out.push({ day: d, key: p, obj: a, name: String(name).trim(), kind: kindOf(a, p) });
    }
    const e = d?.localEats;
    const en = e && (e.venueName || e.name);
    if (en) out.push({ day: d, key: 'localEats', obj: e, name: String(en).trim(), kind: 'food' });
  }
  return out.filter((s) => s.name.length >= 3 && s.name.length <= 150 && !GENERIC.test(s.name));
}

/** Food, walk/nature or a general sight, from the activity text — used to search for a swap. */
function kindOf(a, period) {
  const t = `${a.activity || ''} ${a.location || ''}`.toLowerCase();
  if (/\b(cafe|café|coffee|bakery|brunch|breakfast|pie|patisserie)\b/.test(t)) return 'cafe';
  if (/\b(dinner|lunch|restaurant|eatery|meal|bistro|bar|pub|winery lunch)\b/.test(t)) return 'food';
  if (/\b(walk|trail|track|hike|lake|park|garden|view|lookout|beach|waterfall|reserve|forest|river)\b/.test(t)) return 'nature';
  return period === 'eveningActivity' ? 'food' : 'sight';
}

const SWAP_QUERY = {
  cafe: (town) => `best local cafes in ${town}`,
  food: (town) => `best local restaurants in ${town}`,
  nature: (town) => `scenic walks and nature spots near ${town}`,
  sight: (town) => `top things to do in ${town}`,
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Put the new name wherever the old one appears in this slot's text. */
function swapText(obj, from, to) {
  const re = new RegExp(esc(from), 'gi');
  for (const f of ['activity', 'location', 'insiderTip', 'why', 'name', 'vibe']) {
    if (typeof obj[f] === 'string') obj[f] = obj[f].replace(re, to);
  }
  if (obj.venueName) obj.venueName = to;
  if (obj.location && !new RegExp(esc(to), 'i').test(obj.location)) obj.location = to;
  if (obj.name !== undefined && obj.name !== null && !new RegExp(esc(to), 'i').test(obj.name)) obj.name = to;
  obj.localName = null; // it named the old place
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/**
 * @param itinerary { days: [...] } — changed in place
 * @param opts.townOf(day) → "Queenstown, New Zealand"; opts.biasOf(day) → { lat, lng } | null
 * @returns summary { checked, ok, swapped: [{ day, from, to, reason }], unverified: [{ day, name, reason }] } | null
 */
async function checkItineraryPlaces(itinerary, { townOf, biasOf = () => null, log = console, fetchImpl } = {}) {
  if (!gp.enabled()) return null;
  const slots = slotsOf(itinerary?.days);
  // One lookup per (name, town); the same place on two days is checked once.
  const uniq = new Map();
  for (const s of slots) {
    const k = `${s.name.toLowerCase()}|${townOf(s.day)}`;
    if (!uniq.has(k)) uniq.set(k, { name: s.name, town: townOf(s.day), bias: biasOf(s.day), slots: [] });
    uniq.get(k).slots.push(s);
  }
  const lookups = [...uniq.values()].slice(0, MAX_CHECKS);
  const summary = { checked: lookups.length, ok: 0, swapped: [], unverified: [] };
  const usedNames = new Set(slots.map((s) => s.name.toLowerCase()));
  const usedIds = new Set();

  const results = await pool(lookups, CONCURRENCY, async (l) => {
    try {
      return await gp.checkPlace(l.name, l.town, { bias: l.bias && { ...l.bias, radiusM: 40000 }, fetchImpl });
    } catch (err) {
      log.warn?.('Google check failed for a place', { error: err.message });
      return null; // network trouble: leave this one as it is
    }
  });

  for (let i = 0; i < lookups.length; i += 1) {
    const l = lookups[i]; const r = results[i];
    if (!r) continue;
    if (r.ok) {
      summary.ok += 1;
      usedIds.add(r.place.placeId);
      for (const s of l.slots) s.obj.placeId = r.place.placeId;
    }
  }

  // Swaps, one at a time so two failing places never get the same replacement.
  for (let i = 0; i < lookups.length; i += 1) {
    const l = lookups[i]; const r = results[i];
    if (!r || r.ok) continue;
    const kind = l.slots[0].kind;
    let pick = null;
    try {
      const candidates = await gp.searchText(SWAP_QUERY[kind](l.town), {
        fields: gp.CHECK_FIELDS, pageSize: 10, bias: l.bias && { ...l.bias, radiusM: 30000 }, fetchImpl,
      });
      pick = candidates.find((c) => gp.passesBar(c) && !usedIds.has(c.placeId) && !usedNames.has(c.name.toLowerCase())
        && !/^(locality|administrative_area|country|political|lodging|hotel)/.test(c.primaryType || '')) || null;
    } catch (err) {
      log.warn?.('Google swap search failed', { error: err.message });
    }
    for (const s of l.slots) {
      if (pick) {
        swapText(s.obj, l.name, pick.name);
        s.obj.placeId = pick.placeId;
        summary.swapped.push({ day: s.day.dayNumber, from: l.name, to: pick.name, reason: r.reason });
      } else {
        s.obj.unverified = true;
        summary.unverified.push({ day: s.day.dayNumber, name: l.name, reason: r.reason });
      }
    }
    if (pick) { usedIds.add(pick.placeId); usedNames.add(pick.name.toLowerCase()); }
  }
  return summary;
}

module.exports = { checkItineraryPlaces, slotsOf, kindOf, swapText };
