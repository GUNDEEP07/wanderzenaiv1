const API_URL = import.meta.env.VITE_API_URL;

// Map user activities to backend category names (fallback for exact matches that don't exist)
const ACTIVITY_CATEGORY_MAP = {
  'Hiking': ['Parks'],
  'Food': ['Restaurants', 'Cafes', 'Markets'],
  'Nature': ['Parks'],
  'Culture': ['Temples', 'Museums'],
  'Views': ['Parks'],
  'Nightlife': ['Bars & Nightlife'],
};

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

    // Debug: log what the backend returned
    console.log(`Backend returned categories:`, data.categories?.map(c => c.category) || []);

    // Find categories matching the activity
    const activityLower = activity.toLowerCase();

    // Try exact match first
    let matchingCategory = data.categories?.find(cat =>
      cat.category.toLowerCase() === activityLower
    );

    // If no exact match, try mapped categories
    if (!matchingCategory) {
      const mappedCategories = ACTIVITY_CATEGORY_MAP[activity];
      matchingCategory = data.categories?.find(cat =>
        mappedCategories?.some(mapped => cat.category.toLowerCase() === mapped.toLowerCase())
      );
    }

    if (!matchingCategory) {
      console.warn(`No venues found for activity: ${activity}. Available categories:`, data.categories?.map(c => c.category) || []);
      return [];
    }

    return matchingCategory.venues.map(venue => ({
      id: venue.fsq_id,
      name: venue.name,
      category: venue.category || activity,
      rating: venue.rating || null,
      address: venue.address || 'Address not available',
      instagramUrl: venue.instagramUrl || null,
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
