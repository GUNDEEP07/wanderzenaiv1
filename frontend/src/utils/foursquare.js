const API_URL = import.meta.env.VITE_API_URL;

export async function fetchVenuesForActivity(activity, destination, maxResults = 5) {
  if (!destination || !destination.lat || !destination.lng) {
    console.warn('Destination coordinates required for venue search');
    return [];
  }

  try {
    const params = new URLSearchParams({
      destination: destination.name || 'Unknown',
      lat: destination.lat.toString(),
      lng: destination.lng.toString(),
    });

    const response = await fetch(`${API_URL}/venues?${params}`);

    if (!response.ok) throw new Error(`Venues API error: ${response.status}`);

    const data = await response.json();

    // Find categories matching the activity
    const activityLower = activity.toLowerCase();
    const matchingCategory = data.categories?.find(cat =>
      cat.category.toLowerCase().includes(activityLower) ||
      activityLower.includes(cat.category.toLowerCase().split(' ')[0])
    );

    if (!matchingCategory) {
      console.warn(`No venues found for activity: ${activity}`);
      return [];
    }

    return matchingCategory.venues.map(venue => ({
      id: venue.fsq_id,
      name: venue.name,
      category: venue.category || activity,
      rating: venue.rating || null,
      address: venue.address || 'Address not available',
    }));
  } catch (error) {
    console.error('Failed to fetch venues:', error);
    return [];
  }
}

export function formatRating(rating) {
  if (!rating) return null;
  return `⭐ ${rating.toFixed(1)}`;
}
