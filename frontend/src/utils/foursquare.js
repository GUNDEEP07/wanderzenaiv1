let apiKey = null;

export function setFoursquareApiKey(key) {
  apiKey = key;
}

function getApiKey() {
  // If not set via setFoursquareApiKey, try to get from Vite environment
  if (!apiKey && typeof window !== 'undefined') {
    // Access via globalThis to avoid import.meta syntax errors in CommonJS
    const env = window.__VITE_ENV__ || {};
    return env.VITE_FOURSQUARE_API_KEY;
  }
  return apiKey;
}

export async function fetchVenuesForActivity(activity, destination, maxResults = 5) {
  const key = getApiKey();

  if (!key) {
    console.warn('Foursquare API key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: activity,
      location: destination,
      limit: maxResults.toString(),
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: {
          'Authorization': key,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error(`Foursquare API error: ${response.status}`);

    const data = await response.json();
    if (!data.results) return [];

    return data.results.map(venue => ({
      id: venue.fsq_id,
      name: venue.name,
      category: venue.categories?.[0]?.name || 'Venue',
      rating: venue.rating || null,
      address: venue.location?.address || 'Address not available',
    }));
  } catch (error) {
    console.error('Failed to fetch Foursquare venues:', error);
    return [];
  }
}

export function formatRating(rating) {
  if (!rating) return null;
  return `⭐ ${rating.toFixed(1)}`;
}
