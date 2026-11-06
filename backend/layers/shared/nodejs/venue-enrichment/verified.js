'use strict';

/**
 * Ground Claude's "things to do" in real places.
 *
 * Claude is given a numbered list of real venues (Foursquare Places API) and asked to
 * choose from it. Its answer is then matched back to that list in code: a match gets the
 * venue's real name, address, map link and Foursquare id and is marked verified; anything
 * Claude invented is kept only as a clearly labelled suggestion, and only when there are
 * not enough verified picks.
 */

const normalise = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * Prompt lines listing the venues Claude may choose from.
 * @param {object[]} venues canonical Venue objects (venue-model.js)
 * @param {number} [max=20]
 */
function formatVenueChoices(venues, max = 20) {
  return (venues || []).slice(0, max)
    .map((v, i) => `${i + 1}. ${v.name} — ${v.category}${v.area ? `, ${v.area}` : ''}`)
    .join('\n');
}

/** Find the venue a Claude-written name refers to (exact, then containment either way). */
function matchVenue(name, venues) {
  const key = normalise(name);
  if (!key || key.length < 3) return null;
  const list = venues || [];
  return list.find(v => normalise(v.name) === key) ||
    list.find(v => {
      const vk = normalise(v.name);
      return vk.length >= 4 && (vk.includes(key) || key.includes(vk));
    }) || null;
}

/**
 * @param {object[]} things Claude's thingsToDo ({ name, category, reason, ... })
 * @param {object[]} venues the venues Claude was offered
 * @param {number} [want=3]
 * @returns {object[]} up to `want` items: verified ones first (real name + mapsUrl, address,
 *   fsqPlaceId, source 'foursquare'), then unverified ones labelled source 'ai_suggestion'
 */
function groundThingsToDo(things, venues, want = 3) {
  const verified = [];
  const suggestions = [];
  const used = new Set();
  for (const t of things || []) {
    if (!t || typeof t.name !== 'string') continue;
    const v = matchVenue(t.name, venues);
    if (v && !used.has(v.fsqPlaceId || v.name)) {
      used.add(v.fsqPlaceId || v.name);
      verified.push({
        ...t,
        name: v.name,
        category: t.category || v.category,
        address: v.address || null,
        mapsUrl: v.mapsUrl || null,
        fsqPlaceId: v.fsqPlaceId || null,
        verified: true,
        source: 'foursquare',
      });
    } else if (!v) {
      suggestions.push({ ...t, verified: false, source: 'ai_suggestion' });
    }
  }
  return [...verified, ...suggestions].slice(0, want);
}

module.exports = { formatVenueChoices, matchVenue, groundThingsToDo, _normalise: normalise };
