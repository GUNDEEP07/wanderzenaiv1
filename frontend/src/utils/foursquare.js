const API_URL = import.meta.env.VITE_API_URL;

// Map user activities to backend category names (fallback for exact matches that don't exist)
const ACTIVITY_CATEGORY_MAP = {
  'Hiking': ['Hiking Trails', 'Viewpoints'],
  'Food': ['Restaurants', 'Cafes', 'Markets'],
  'Nature': ['Parks'],
  'Culture': ['Temples', 'Museums'],
  'Views': ['Viewpoints'],
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
      activity: activity,
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
      photoUrl: venue.photoUrl || null,
      photos: venue.photos || [],
      lat: venue.lat || null,
      lng: venue.lng || null,
      attributes: venue.attributes || null,
      hours: venue.hours || null,
      website: venue.website || null,
      tel: venue.tel || null,
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

export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  if (distance < 1) return `${Math.round(distance * 1000)}m`;
  return `${distance.toFixed(1)}km`;
}
