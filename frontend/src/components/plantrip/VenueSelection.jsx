import { useState, useEffect } from 'react';
import './styles/venueselection.css';

const API_URL = import.meta.env.VITE_API_URL;
const MAX_VENUES_PER_CATEGORY = 5;

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
      setError('Unable to load venue recommendations. You can continue without selecting venues.');
      setCategories([]);
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
