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
    const primaryDestination = Array.isArray(formData.destinations) && formData.destinations.length > 0
      ? formData.destinations[0]
      : formData.destination;

    const res = await fetch(`${API_URL}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: typeof primaryDestination === 'object' ? primaryDestination.name : primaryDestination,
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
  const primaryDestination = Array.isArray(formData.destinations) && formData.destinations.length > 0
    ? formData.destinations[0]
    : { name: formData.destination || '', lat: 0, lng: 0 };

  const destinationName = typeof primaryDestination === 'object' ? primaryDestination.name : primaryDestination;

  const res = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      destination: destinationName,
      destinations: Array.isArray(formData.destinations) ? formData.destinations : [],
      destinationLat: typeof primaryDestination === 'object' ? primaryDestination.lat : 0,
      destinationLng: typeof primaryDestination === 'object' ? primaryDestination.lng : 0,
      days: +formData.days,
      budget: +formData.budget,
      travelDate: formData.travelDate && formData.travelDate.trim() !== '' ? formData.travelDate : null,
      startTime: formData.startTime || '09:00',
      userMustDos: formData.userMustDos && formData.userMustDos.trim() !== '' ? formData.userMustDos.trim() : null,
      selected_venues: formData.selected_venues || { activities: {}, venues: {} },
    }),
  });
  const data = await res.json();
  return { status: res.status, data };
}
