/**
 * Partner ("affiliate") links for the trip page's "Book your trip" checklist (design C2,
 * approved Nov 16 2026). Partner IDs are public and come from repo variables at build time:
 *   VITE_BOOKING_AID        Booking.com affiliate id  → `aid`
 *   VITE_GYG_PARTNER_ID     GetYourGuide partner id   → `partner_id`
 * Without an id the link is the same search with no tag — and we don't claim a commission
 * (`hasPartnerIds()` decides whether the disclosure shows). No prices anywhere: the sites show
 * real ones.
 */
const BOOKING_AID = String(import.meta.env.VITE_BOOKING_AID || '').trim();
const GYG_PARTNER_ID = String(import.meta.env.VITE_GYG_PARTNER_ID || '').trim();

export const hasPartnerIds = (ids = { BOOKING_AID, GYG_PARTNER_ID }) => Boolean(ids.BOOKING_AID || ids.GYG_PARTNER_ID);

/** Booking.com search for a town and dates; tagged when we have an affiliate id. */
export function bookingUrl({ place, checkin, checkout, adults = 2 }, aid = BOOKING_AID) {
  const u = new URL('https://www.booking.com/searchresults.html');
  u.searchParams.set('ss', place);
  if (checkin && checkout) { u.searchParams.set('checkin', checkin); u.searchParams.set('checkout', checkout); }
  u.searchParams.set('group_adults', String(adults));
  if (aid) u.searchParams.set('aid', aid);
  return u.toString();
}

/** GetYourGuide search for things to do around a town. */
export function toursUrl({ place, date }, partnerId = GYG_PARTNER_ID) {
  const u = new URL('https://www.getyourguide.com/s/');
  u.searchParams.set('q', place);
  if (date) u.searchParams.set('date_from', date);
  if (partnerId) u.searchParams.set('partner_id', partnerId);
  return u.toString();
}
