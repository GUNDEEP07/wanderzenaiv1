// src/api/itinerary.js
// All API calls related to itinerary generation.

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Fetch a lightweight day-outline preview from Claude.
 * Returns in ~4 seconds. No DB write, no PDF, no email.
 */
export async function fetchPreview(formData) {
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
  const json = await res.json();
  // Lambda ok() wraps responses as { success: true, data: { ... } }
  return json.data || json;
}

/**
 * Submit the full itinerary request.
 * Returns { status, data } — caller checks status for 402.
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
