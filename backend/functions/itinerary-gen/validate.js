'use strict';

/**
 * Q3 (part 1) — checks on a generated itinerary before it is stored and rendered.
 *
 * Pure functions, no I/O: the handler supplies the days and the Step 3 pick coverage
 * (from shared selected-venues.js findMissingPicks) and decides what to regenerate.
 *
 * Checked now:   the same named venue on more than one day; Step 3 picks missing or on
 *                the wrong day.
 * Not yet:       distance from the day's base (needs Q2's route plan), budget
 *                reconciliation (needs Q4's budget scope).
 */

const ACTIVITY_SLOTS = ['morningActivity', 'afternoonActivity', 'eveningActivity'];
const MAX_REPAIR_DAYS = 3;

const normalise = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\([^)]*\)/g, ' ')       // "Fushimi Inari (伏見稲荷大社)" → "fushimi inari"
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Named venues on a day: venueName on each activity and on localEats. */
function namedVenues(day) {
  const out = [];
  for (const slot of ACTIVITY_SLOTS) {
    const name = day?.[slot]?.venueName;
    if (name) out.push({ slot, name });
  }
  if (day?.localEats?.venueName) out.push({ slot: 'localEats', name: day.localEats.venueName });
  return out;
}

/**
 * The same named venue appearing on more than one day. The first day keeps it; later
 * days are flagged. Repeats within a single day are left alone (e.g. lunch then a walk
 * in the same market).
 * @returns {Array<{ name: string, firstDay: number, repeatDays: number[] }>}
 */
function findDuplicateVenues(days) {
  const seen = new Map(); // key → { name, firstDay, repeatDays:Set }
  const sorted = [...(days || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  for (const day of sorted) {
    const keysToday = new Set();
    for (const { name } of namedVenues(day)) {
      const key = normalise(name);
      if (!key || key.length < 3 || keysToday.has(key)) continue;
      keysToday.add(key);
      const entry = seen.get(key);
      if (!entry) seen.set(key, { name, firstDay: day.dayNumber, repeatDays: new Set() });
      else entry.repeatDays.add(day.dayNumber);
    }
  }
  return [...seen.values()]
    .filter(e => e.repeatDays.size)
    .map(e => ({ name: e.name, firstDay: e.firstDay, repeatDays: [...e.repeatDays].sort((a, b) => a - b) }));
}

/**
 * Decide which days to regenerate and what to tell Claude for each.
 * Pick problems outrank duplicates (the traveller asked for those places explicitly).
 * @param {object} args
 * @param {object[]} args.days
 * @param {{ missing: object[], wrongDay: object[] }} args.coverage from findMissingPicks
 * @param {number} [args.maxDays]
 * @returns {Map<number, { avoid: string[], include: object[], reasons: string[] }>}
 */
function planRepairs({ days, coverage, maxDays = MAX_REPAIR_DAYS }) {
  const repairs = new Map();
  const get = (d) => {
    if (!repairs.has(d)) repairs.set(d, { avoid: [], include: [], reasons: [] });
    return repairs.get(d);
  };
  const dayNumbers = new Set((days || []).map(d => d.dayNumber));

  for (const p of [...(coverage?.missing || []), ...(coverage?.wrongDay || [])]) {
    if (!dayNumbers.has(p.day)) continue;
    const r = get(p.day);
    r.include.push(p);
    r.reasons.push(`pick:${p.name}`);
  }

  // Every day being regenerated must avoid every venue used on any other day.
  const duplicates = findDuplicateVenues(days);
  for (const dup of duplicates) {
    for (const d of dup.repeatDays) get(d).reasons.push(`duplicate:${dup.name}`);
  }

  const chosen = [...repairs.keys()]
    .sort((a, b) => {
      const pa = repairs.get(a).include.length ? 0 : 1;
      const pb = repairs.get(b).include.length ? 0 : 1;
      return pa - pb || a - b;
    })
    .slice(0, maxDays);
  const limited = new Map(chosen.sort((a, b) => a - b).map(d => [d, repairs.get(d)]));

  for (const [d, r] of limited) {
    const elsewhere = new Set();
    for (const day of days) {
      if (day.dayNumber === d) continue;
      for (const { name } of namedVenues(day)) elsewhere.add(name);
    }
    r.avoid = [...elsewhere];
  }
  return limited;
}

/** Extra prompt rules for regenerating one day. */
function repairRules(repair) {
  const lines = ['\n\nThis day is being REWRITTEN because the first version broke these rules.'];
  if (repair.avoid.length) {
    lines.push(`Do NOT use any of these places — they already appear on other days: ${repair.avoid.join('; ')}.`);
  }
  if (repair.include.length) {
    lines.push('You MUST include these places the traveller picked, with venueName set to exactly this name:');
    for (const p of repair.include) lines.push(`- ${p.name}${p.address ? ` — ${p.address}` : ''}`);
  }
  return lines.join('\n');
}

module.exports = { findDuplicateVenues, planRepairs, repairRules, MAX_REPAIR_DAYS };
