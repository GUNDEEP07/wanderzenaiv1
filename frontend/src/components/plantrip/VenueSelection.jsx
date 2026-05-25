import { useState, useEffect } from 'react';
import './styles/venueselection.css';

const API_URL = import.meta.env.VITE_API_URL;
const MAX_VENUES_PER_CATEGORY = 5;

const FALLBACK_VENUES = [
  {
    category: 'Restaurants',
    venues: [
      { fsq_id: 'r1', name: 'Local Market Restaurant', rating: 4.5, address: 'Central Market District' },
      { fsq_id: 'r2', name: 'Street Food Cart', rating: 4.3, address: 'Night Market' },
      { fsq_id: 'r3', name: 'Traditional Cuisine', rating: 4.7, address: 'Old Town' },
      { fsq_id: 'r4', name: 'Rooftop Bistro', rating: 4.6, address: 'Downtown' },
      { fsq_id: 'r5', name: 'Hidden Gem Eatery', rating: 4.4, address: 'Local Neighborhood' },
    ],
  },
  {
    category: 'Cafes',
    venues: [
      { fsq_id: 'c1', name: 'Morning Brew Cafe', rating: 4.4, address: 'City Center' },
      { fsq_id: 'c2', name: 'Artisan Coffee House', rating: 4.6, address: 'Creative Quarter' },
      { fsq_id: 'c3', name: 'Quiet Reading Corner', rating: 4.5, address: 'Residential Area' },
      { fsq_id: 'c4', name: 'Modern Cafe', rating: 4.3, address: 'Business District' },
      { fsq_id: 'c5', name: 'Garden Cafe', rating: 4.7, address: 'Park Side' },
    ],
  },
  {
    category: 'Parks',
    venues: [
      { fsq_id: 'p1', name: 'Central Park', rating: 4.6, address: 'City Center' },
      { fsq_id: 'p2', name: 'Nature Trail Park', rating: 4.5, address: 'Outskirts' },
      { fsq_id: 'p3', name: 'Riverside Gardens', rating: 4.7, address: 'Waterfront' },
      { fsq_id: 'p4', name: 'Urban Green Space', rating: 4.4, address: 'Downtown' },
      { fsq_id: 'p5', name: 'Botanical Garden', rating: 4.8, address: 'North Side' },
    ],
  },
  {
    category: 'Temples',
    venues: [
      { fsq_id: 't1', name: 'Ancient Temple', rating: 4.7, address: 'Historic District' },
      { fsq_id: 't2', name: 'Sacred Shrine', rating: 4.6, address: 'Religious Quarter' },
      { fsq_id: 't3', name: 'Spiritual Center', rating: 4.5, address: 'Old Town' },
      { fsq_id: 't4', name: 'Peaceful Monastery', rating: 4.8, address: 'Mountain Area' },
      { fsq_id: 't5', name: 'Meditation Temple', rating: 4.4, address: 'Quiet Village' },
    ],
  },
  {
    category: 'Museums',
    venues: [
      { fsq_id: 'm1', name: 'National Museum', rating: 4.6, address: 'Cultural District' },
      { fsq_id: 'm2', name: 'Art Gallery', rating: 4.5, address: 'Downtown' },
      { fsq_id: 'm3', name: 'Local History Museum', rating: 4.4, address: 'Old Town' },
      { fsq_id: 'm4', name: 'Modern Art Space', rating: 4.7, address: 'Creative Quarter' },
      { fsq_id: 'm5', name: 'Heritage Center', rating: 4.5, address: 'Historic Area' },
    ],
  },
  {
    category: 'Hiking Trails',
    venues: [
      { fsq_id: 'h1', name: 'Mountain Peak Trail', rating: 4.8, address: 'High Mountains' },
      { fsq_id: 'h2', name: 'Forest Nature Walk', rating: 4.6, address: 'Forested Area' },
      { fsq_id: 'h3', name: 'Valley Loop Trail', rating: 4.7, address: 'Valley Region' },
      { fsq_id: 'h4', name: 'Scenic Ridge Path', rating: 4.5, address: 'Ridge Area' },
      { fsq_id: 'h5', name: 'Waterfall Hike', rating: 4.9, address: 'Water Cascade Zone' },
    ],
  },
  {
    category: 'Viewpoints',
    venues: [
      { fsq_id: 'v1', name: 'City Skyline View', rating: 4.7, address: 'Observation Deck' },
      { fsq_id: 'v2', name: 'Sunset Lookout', rating: 4.8, address: 'Hill Top' },
      { fsq_id: 'v3', name: 'Scenic Overlook', rating: 4.6, address: 'Cliff Edge' },
      { fsq_id: 'v4', name: 'Valley Vista', rating: 4.5, address: 'Plateau' },
      { fsq_id: 'v5', name: 'Panoramic View Point', rating: 4.9, address: 'Tower Top' },
    ],
  },
  {
    category: 'Markets',
    venues: [
      { fsq_id: 'mk1', name: 'Central Market', rating: 4.5, address: 'Market District' },
      { fsq_id: 'mk2', name: 'Night Bazaar', rating: 4.6, address: 'Night Market' },
      { fsq_id: 'mk3', name: 'Local Farmers Market', rating: 4.7, address: 'Suburb' },
      { fsq_id: 'mk4', name: 'Craft Market', rating: 4.4, address: 'Old Quarter' },
      { fsq_id: 'mk5', name: 'Street Market', rating: 4.5, address: 'Downtown' },
    ],
  },
  {
    category: 'Bars & Nightlife',
    venues: [
      { fsq_id: 'b1', name: 'Rooftop Bar', rating: 4.6, address: 'High Rise' },
      { fsq_id: 'b2', name: 'Live Music Venue', rating: 4.7, address: 'Entertainment District' },
      { fsq_id: 'b3', name: 'Cocktail Lounge', rating: 4.5, address: 'Downtown' },
      { fsq_id: 'b4', name: 'Night Club', rating: 4.4, address: 'Party Zone' },
      { fsq_id: 'b5', name: 'Jazz Bar', rating: 4.8, address: 'Cultural Quarter' },
    ],
  },
  {
    category: 'Accommodations',
    venues: [
      { fsq_id: 'a1', name: 'Luxury Hotel', rating: 4.7, address: 'Downtown' },
      { fsq_id: 'a2', name: 'Boutique Guest House', rating: 4.8, address: 'Old Town' },
      { fsq_id: 'a3', name: 'Budget Hostel', rating: 4.3, address: 'Backpacker Zone' },
      { fsq_id: 'a4', name: 'Eco Resort', rating: 4.6, address: 'Nature Area' },
      { fsq_id: 'a5', name: 'Heritage Villa', rating: 4.9, address: 'Historic District' },
    ],
  },
];

export function VenueSelection({ destination, lat, lng, onSubmit, onSkip }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVenues();
  }, [destination, lat, lng]);

  const fetchVenues = async () => {
    if (!lat || !lng) {
      setError('Missing location coordinates');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `${API_URL}/venues?destination=${encodeURIComponent(destination)}&lat=${lat}&lng=${lng}`
      );
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Venues fetch failed:', err);
      // Use fallback venues for local testing
      setCategories(FALLBACK_VENUES);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleVenue = (categoryName, fsqId) => {
    setSelected((prev) => {
      const categoryVenues = prev[categoryName] || [];
      const isSelected = categoryVenues.includes(fsqId);

      if (isSelected) {
        return {
          ...prev,
          [categoryName]: categoryVenues.filter((id) => id !== fsqId),
        };
      } else if (categoryVenues.length < MAX_VENUES_PER_CATEGORY) {
        return {
          ...prev,
          [categoryName]: [...categoryVenues, fsqId],
        };
      }
      return prev;
    });
  };

  const handleContinue = () => {
    onSubmit(selected);
  };

  const handleSkip = () => {
    onSkip();
  };

  if (loading) {
    return (
      <div className="venue-selection loading">
        <div className="spinner"></div>
        <p>Loading venue recommendations...</p>
      </div>
    );
  }

  return (
    <div className="venue-selection">
      <div className="venue-selection-header">
        <h2>Select venues for {destination}</h2>
        <p className="hint">
          Pick up to {MAX_VENUES_PER_CATEGORY} venues per category (optional)
        </p>
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      {categories.length === 0 && !error && (
        <div className="no-venues">
          <p>No venue recommendations available for this location.</p>
        </div>
      )}

      <div className="categories-grid">
        {categories.map((cat) => (
          <div key={cat.category} className="category-section">
            <h3 className="category-title">{cat.category}</h3>
            <div className="venues-list">
              {cat.venues.map((venue) => {
                const categoryVenues = selected[cat.category] || [];
                const isSelected = categoryVenues.includes(venue.fsq_id);
                const isFull =
                  categoryVenues.length >= MAX_VENUES_PER_CATEGORY &&
                  !isSelected;

                return (
                  <label
                    key={venue.fsq_id}
                    className={`venue-item ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleVenue(cat.category, venue.fsq_id)
                      }
                      disabled={isFull}
                      className="venue-checkbox"
                    />
                    <div className="venue-info">
                      <div className="venue-name">{venue.name}</div>
                      {venue.rating && (
                        <div className="venue-rating">
                          ⭐ {venue.rating.toFixed(1)}
                        </div>
                      )}
                      {venue.address && (
                        <div className="venue-address">{venue.address}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="venue-selection-actions">
        <button
          onClick={handleContinue}
          className="btn btn-primary"
        >
          Continue with Selections
        </button>
        <button
          onClick={handleSkip}
          className="btn btn-secondary"
        >
          Skip Venue Selection
        </button>
      </div>
    </div>
  );
}
