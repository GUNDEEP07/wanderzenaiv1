// src/api/itinerary.js
// All API calls related to itinerary generation.
// Import API_URL from env — never hardcode.

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
 * Fetch a lightweight day-outline preview from Claude.
 * No DB write, no PDF, no email. Returns in ~4 seconds.
 * @param {Object} formData
 * @returns {Promise<{days: Array<{day: number, theme: string, vibe: string}>}>}
 */
export async function fetchPreview(formData) {
  try {
    const res = await fetch(`${API_URL}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: formData.destination,
        days: +formData.days,
        travelerType: formData.travelerType,
        travelStyle: formData.travelStyle,
        travelPace: formData.travelPace,
        startTime: formData.startTime || '09:00',
        userMustDos: formData.userMustDos || '',
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
 * @param {Object} formData
 * @returns {Promise<{success: boolean, data: {submissionId: string}}>}
 */
export async function submitItinerary(formData) {
  const res = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      days: +formData.days,
      budget: +formData.budget,
      travelDate: formData.travelDate && formData.travelDate.trim() !== '' ? formData.travelDate : null,
      startTime: formData.startTime || '09:00',
      userMustDos: formData.userMustDos && formData.userMustDos.trim() !== '' ? formData.userMustDos.trim() : null,
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}
