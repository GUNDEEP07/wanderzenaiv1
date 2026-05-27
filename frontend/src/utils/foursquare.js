const API_URL = import.meta.env.VITE_API_URL;

// Map user activities to Foursquare category names (from foursquare_categories table)
const ACTIVITY_CATEGORY_MAP = {
  'Hiking': ['Hiking Trail', 'Viewpoint'],
  'Food': ['Restaurant', 'Cafe', 'Market', 'Bakery'],
  'Nature': ['Park', 'Garden', 'Botanical Garden', 'Zoo'],
  'Culture': ['Temple', 'Museum', 'Historic Site', 'Art Gallery', 'Landmark', 'Monument', 'Religious Site'],
  'Views': ['Viewpoint', 'Landmark', 'Bridge'],
  'Nightlife': ['Bar', 'Nightlife Spot', 'Music Venue'],
  'Parks': ['Park', 'Garden', 'Botanical Garden', 'Playground'],
  'Spa': ['Spa', 'Yoga Studio'],
  'Adventure': ['Hiking Trail', 'Sports', 'Amusement Park', 'Water Sports'],
  'Beaches': ['Beach'],
  'Shopping': ['Shopping'],
  'Markets': ['Market'],
  'Wellness': ['Spa', 'Yoga Studio', 'Gym', 'Park'],
  'Museums': ['Museum', 'Art Gallery', 'Aquarium'],
  'Restaurants': ['Restaurant'],
  'Cafes': ['Cafe', 'Coffee Shop'],
};

// Map travel styles to available activities
const TRAVEL_STYLE_TO_ACTIVITIES = {
  'Relaxation': ['Food', 'Spa', 'Parks', 'Beaches', 'Cafes', 'Markets'],
  'Adventure': ['Hiking', 'Adventure', 'Sports', 'Beaches', 'Nature', 'Culture'],
  'Cultural': ['Culture', 'Museums', 'Landmarks', 'Restaurants', 'Markets', 'Shopping'],
  'Foodie': ['Food', 'Restaurants', 'Markets', 'Cafes', 'Nightlife'],
  'Nature': ['Nature', 'Parks', 'Hiking', 'Beaches', 'Views'],
  'Wellness': ['Wellness', 'Spa', 'Cafes', 'Parks', 'Food'],
  'Luxury': ['Restaurants', 'Shopping', 'Spa', 'Culture', 'Nightlife'],
};

export function getActivitiesForTravelStyle(travelStyles) {
  if (!travelStyles || travelStyles.length === 0) {
    return ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Parks', 'Spa'];
  }

  const activitiesSet = new Set();
  travelStyles.forEach(style => {
    const activities = TRAVEL_STYLE_TO_ACTIVITIES[style] || [];
    activities.forEach(activity => activitiesSet.add(activity));
  });

  return Array.from(activitiesSet);
}

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

    const response = await fetch(`${API_URL}/recommendations/venues?${params}`);

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
      reviewCount: venue.reviewCount || 0,
      score: venue.score || 0,
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
