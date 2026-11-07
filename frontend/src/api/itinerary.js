// src/api/itinerary.js
// All API calls related to itinerary generation.
// Import API_URL from env — never hardcode.

import { sendEmailVerification } from 'firebase/auth';
import { auth, FIREBASE_CONFIGURED } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL;

const FALLBACK_PREVIEW = {
  days: [
    { day: 1, theme: 'Arrival & orientation', vibe: 'Relaxed first impressions' },
    { day: 2, theme: 'Local exploration', vibe: 'Discovering hidden gems' },
    { day: 3, theme: 'Cultural immersion', vibe: 'Deep local experiences' },
    { day: 4, theme: 'Adventure & activities', vibe: 'Active exploration' },
    { day: 5, theme: 'Reflection & departure', vibe: 'Savoring memories' },
    { day: 6, theme: 'Extended discovery', vibe: 'Bonus adventures' },
    { day: 7, theme: 'Deep dive', vibe: 'Complete immersion' },
  ]
};

/**
 * Headers for an authenticated call. /preview and /submit identify the caller from the
 * Firebase ID token; the backend ignores any email in the request body.
 * @returns {Promise<Record<string, string>>}
 */
async function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const user = FIREBASE_CONFIGURED ? auth?.currentUser : null;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return headers;
}

/**
 * The backend answers 403 EMAIL_NOT_VERIFIED for email/password accounts that haven't
 * clicked their verification link. Resend it so the message we show is actionable.
 */
async function resendVerificationIfNeeded(status, data) {
  if (status !== 403 || data?.code !== 'EMAIL_NOT_VERIFIED') return;
  const user = FIREBASE_CONFIGURED ? auth?.currentUser : null;
  if (!user || user.emailVerified) return;
  try {
    await sendEmailVerification(user);
  } catch {
    /* Firebase throttles resends; the original email still works */
  }
}

/**
 * Fetch a lightweight day-outline preview from Claude.
 * No DB write, no PDF, no email. Returns in ~4 seconds.
 * @param {Object} formData
 * @returns {Promise<{days: Array<{day: number, theme: string, vibe: string}>}>}
 */
/**
 * Suggest 2–3 routes (bases, days per base, transfers, day trips) for the trip.
 * POST /route-plan — open to guests (rate limited by IP), like /preview. Curated routes for the launch
 * countries; Claude for the rest, or for "more" ideas (avoiding the ones shown).
 * @param {Object} formData
 * @param {{ more?: boolean, avoid?: string[] }} [opts]
 * @returns {Promise<{ source: 'curated'|'ai'|'mixed', country: string|null, options: object[] }>}
 * @throws {Error} with a user-facing message
 */
export async function fetchRoutePlan(formData, { more = false, avoid = [] } = {}) {
  const primary = Array.isArray(formData.destinations) && formData.destinations.length > 0
    ? formData.destinations[0] : formData.destination;
  const destination = typeof primary === 'object'
    ? [primary.name, primary.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
    : primary;
  const res = await fetch(`${API_URL}/route-plan`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      destination,
      days: +formData.days,
      travelStyle: formData.travelStyle,
      travelPace: formData.travelPace,
      interests: formData.interests || '',
      travelDate: formData.travelDate || '',
      userLocation: formData.userLocation || '',
      prefs: formData.tripPrefs || undefined,
      more: more === true,
      avoid: (avoid || []).slice(0, 12),
    }),
  });
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  await resendVerificationIfNeeded(res.status, data);
  if (res.status === 429) {
    const signedIn = FIREBASE_CONFIGURED && !!auth?.currentUser;
    throw new Error(signedIn
      ? 'You have planned a lot of routes in a short time — please wait a few minutes.'
      : 'You have tried a lot of routes — create a free account to keep planning (your trip is kept).');
  }
  if (!res.ok || !Array.isArray(data?.data?.options) || !data.data.options.length) {
    throw new Error(data?.message || 'Could not plan a route right now. Please try again.');
  }
  return data.data;
}

export async function fetchPreview(formData) {
  try {
    const primaryDestination = Array.isArray(formData.destinations) && formData.destinations.length > 0
      ? formData.destinations[0]
      : formData.destination;

    const res = await fetch(`${API_URL}/preview`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        destination: typeof primaryDestination === 'object' ? primaryDestination.name : primaryDestination,
        days: +formData.days,
        travelerType: formData.travelerType,
        travelStyle: formData.travelStyle,
        travelPace: formData.travelPace,
        startTime: formData.startTime || '09:00',
        userMustDos: formData.userMustDos || '',
        route: formData.route || undefined, // the outline follows the confirmed route
        prefs: formData.tripPrefs || undefined, // who's travelling (kids, travel-time comfort)
      }),
    });
    if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error('Preview API failed, using fallback:', err.message);
    // Return fallback preview for local testing
    return {
      ...FALLBACK_PREVIEW,
      days: FALLBACK_PREVIEW.days.slice(0, +formData.days),
    };
  }
}

/**
 * Submit the full itinerary request.
 * Triggers itinerary-gen Lambda async. Returns submissionId immediately.
 * The itinerary is delivered to the signed-in account's email address.
 * @param {Object} formData
 * @returns {Promise<{status: number, data: {success: boolean, data?: {submissionId: string}, message?: string, code?: string}}>}
 */
export async function submitItinerary(formData) {
  const primaryDestination = Array.isArray(formData.destinations) && formData.destinations.length > 0
    ? formData.destinations[0]
    : { name: formData.destination || '', lat: 0, lng: 0 };

  const destinationName = typeof primaryDestination === 'object' ? primaryDestination.name : primaryDestination;

  // Not sent: the backend takes the delivery address from the verified token.
  const { email: _ignoredEmail, ...rest } = formData;

  const res = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      ...rest,
      destination: destinationName,
      destinations: Array.isArray(formData.destinations) ? formData.destinations : [],
      destinationLat: typeof primaryDestination === 'object' ? primaryDestination.lat : 0,
      destinationLng: typeof primaryDestination === 'object' ? primaryDestination.lng : 0,
      days: +formData.days,
      budget: +formData.budget,
      travelDate: formData.travelDate && formData.travelDate.trim() !== '' ? formData.travelDate : null,
      startTime: formData.startTime || '09:00',
      userMustDos: formData.userMustDos && formData.userMustDos.trim() !== '' ? formData.userMustDos.trim() : null,
      // The confirmed route travels inside selected_venues (also when Step 3 was skipped).
      selected_venues: {
        ...(formData.selected_venues?.version === 2 ? formData.selected_venues : { version: 2, picks: [], interests: [] }),
        ...(formData.route ? { route: formData.route } : {}),
        ...(formData.tripPrefs ? { tripPrefs: formData.tripPrefs } : {}),
      },
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: 'Something went wrong. Please try again.' };
  }
  await resendVerificationIfNeeded(res.status, data);
  return { status: res.status, data };
}

/**
 * Live progress of a trip being written (owner only).
 * GET /itinerary/{id}/progress → { status, stage, totalDays, route[], days[], failed, message }
 * @param {string} submissionId
 * @returns {Promise<{ ok: true, data: object } | { ok: false, status: number }>}
 */
export async function fetchProgress(submissionId) {
  try {
    const res = await fetch(`${API_URL}/itinerary/${encodeURIComponent(submissionId)}/progress`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json();
    return data?.success ? { ok: true, data: data.data } : { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 }; // offline / network hiccup — the caller keeps polling
  }
}

/**
 * What the next itinerary would use, shown on the Review step before Submit (read-only).
 * GET /entitlement → { allowed, source: 'test'|'monthly'|'credit'|'free'|null, remaining, code? }
 * @returns {Promise<object|null>} null when signed out or the check fails (the page then
 *   behaves as before: Submit decides)
 */
export async function fetchEntitlement() {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch(`${API_URL}/entitlement`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * The trip being planned, saved to the account so it survives closing the tab or switching
 * device. GET / PUT / DELETE /profile/draft. All best-effort: failures never block planning.
 */
export async function fetchPlanDraft() {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch(`${API_URL}/profile/draft`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json())?.draft || null;
  } catch {
    return null;
  }
}

export async function savePlanDraft(form, step) {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return false;
    // The address comes from the account; no need to store it in the draft.
    const { email: _e, ...rest } = form || {};
    const res = await fetch(`${API_URL}/profile/draft`, { method: 'PUT', headers, body: JSON.stringify({ form: rest, step }) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deletePlanDraft() {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return;
    await fetch(`${API_URL}/profile/draft`, { method: 'DELETE', headers });
  } catch { /* best effort */ }
}
