/**
 * "Add to calendar": the trip as an iCalendar (.ics) file — one event per activity at its
 * time (2 h long, floating local time so it shows at that hour wherever the phone is), and
 * an all-day event per day with the theme, food and hidden gem. Built in the browser from
 * the trip already on the page; nothing is sent anywhere.
 */
import { dayDate, dayStops, directionsUrl } from './tripPlan';
import { plainText } from './plainText';

const pad = (n) => String(n).padStart(2, '0');
const dateOnly = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const localStamp = (d, minutes) => `${dateOnly(d)}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;

/** RFC 5545 text escaping. */
export const escapeText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Folds a content line to 75 octets (UTF-8), continuation lines start with a space. */
export function fold(line) {
  const bytes = (s) => unescape(encodeURIComponent(s)).length; // UTF-8 length, no TextEncoder needed
  if (bytes(line) <= 75) return line;
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = bytes(ch);
    const limit = out.length ? 74 : 75;
    if (curBytes + b > limit) { out.push(cur); cur = ''; curBytes = 0; }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/**
 * @param {object} trip { submissionId, destination, travelDate, itinerary }
 * @param {Date} [now]
 * @returns {string|null} the .ics text, or null without a start date
 */
export function buildIcs(trip, now = new Date()) {
  const days = trip?.itinerary?.days || [];
  if (!trip?.travelDate || !days.length || !dayDate(trip.travelDate, 1)) return null;
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const uidBase = String(trip.submissionId || 'trip').replace(/[^A-Za-z0-9_-]/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WanderZenAI//Trip//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(trip.itinerary.title || `${trip.destination} trip`)}`];
  const event = (uid, fields) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}@wanderzenai.com`, `DTSTAMP:${stamp}`, ...fields, 'END:VEVENT');
  };

  for (const day of days) {
    const d = dayDate(trip.travelDate, day.dayNumber);
    if (!d) continue;
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const stops = dayStops(day);
    const eat = stops.find(s => s.kind === 'eat');
    const gem = stops.find(s => s.kind === 'gem');
    const notes = [day.theme, eat ? `Eat: ${eat.title}${eat.eats?.dish ? ` (${eat.eats.dish})` : ''}` : '', gem ? `Hidden gem: ${plainText(gem.title)}` : ''].filter(Boolean).join('\n');
    event(`${uidBase}-d${day.dayNumber}`, [
      `DTSTART;VALUE=DATE:${dateOnly(d)}`, `DTEND;VALUE=DATE:${dateOnly(next)}`,
      `SUMMARY:${escapeText(`Day ${day.dayNumber}${day.base ? ` · ${day.base}` : ''}: ${day.theme || trip.destination}`)}`,
      `DESCRIPTION:${escapeText(notes)}`, 'TRANSP:TRANSPARENT',
    ]);
    for (const s of stops.filter(x => x.kind === 'activity')) {
      const start = s.minutes;
      const end = Math.min(start + 120, 23 * 60 + 59);
      const desc = [plainText(s.act.why), s.act.insiderTip ? `Insider tip: ${plainText(s.act.insiderTip)}` : '', s.act.localName ? `Local name: ${s.act.localName}` : '', `Directions: ${directionsUrl(s.place, day.base, trip.destination)}`].filter(Boolean).join('\n\n');
      event(`${uidBase}-d${day.dayNumber}-${s.id}`, [
        `DTSTART:${localStamp(d, start)}`, `DTEND:${localStamp(d, end)}`,
        `SUMMARY:${escapeText(s.title)}`,
        `LOCATION:${escapeText([s.act.location, s.act.localName].filter(Boolean).join(' · '))}`,
        `DESCRIPTION:${escapeText(desc)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(s.title)}`, 'TRIGGER:-PT30M', 'END:VALARM',
      ]);
    }
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
