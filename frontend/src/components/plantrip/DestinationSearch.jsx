import { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';
import './styles/destinationsearch.css';

const API_URL = import.meta.env.VITE_API_URL;

export function DestinationSearch({ onSelect, disabled, allowMultiple = false, initialSelected = null }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => {
    if (!allowMultiple) return initialSelected || null;
    if (initialSelected && Array.isArray(initialSelected) && initialSelected.length > 0) {
      return initialSelected.map(d => ({
        fsq_id: d.fsq_id || d.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        name: d.name || '',
        country: d.country || '',
        lat: d.lat || 0,
        lng: d.lng || 0,
      }));
    }
    return [];
  });

  // Sync selected with initialSelected when it changes (e.g., prefilled destinations)
  useEffect(() => {
    if (!allowMultiple || !initialSelected) return;
    if (Array.isArray(initialSelected) && initialSelected.length > 0) {
      setSelected(initialSelected.map(d => ({
        fsq_id: d.fsq_id || d.name?.toLowerCase().replace(/\s+/g, '-') || 'unknown',
        name: d.name || '',
        country: d.country || '',
        lat: d.lat || 0,
        lng: d.lng || 0,
      })));
    }
  }, [allowMultiple, initialSelected]);

  const allDestinations = [
    { fsq_id: 'kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
    { fsq_id: 'bangkok', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
    { fsq_id: 'bali', name: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
    { fsq_id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    { fsq_id: 'oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lng: -96.7266 },
    { fsq_id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
    { fsq_id: 'new-york', name: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
    { fsq_id: 'london', name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
    { fsq_id: 'dubai', name: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
    { fsq_id: 'delhi', name: 'Delhi', country: 'India', lat: 28.7041, lng: 77.1025 },
    { fsq_id: 'barcelona', name: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734 },
    { fsq_id: 'istanbul', name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
  ];

  const filterDestinations = (query) => {
    if (query.trim().length < 1) return [];

    const lowerQuery = query.toLowerCase();

    return allDestinations
      .filter(dest =>
        dest.name.toLowerCase().includes(lowerQuery) ||
        dest.country.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Exact match first
        if (nameA === lowerQuery) return -1;
        if (nameB === lowerQuery) return 1;

        // Starts with query
        if (nameA.startsWith(lowerQuery) && !nameB.startsWith(lowerQuery)) return -1;
        if (nameB.startsWith(lowerQuery) && !nameA.startsWith(lowerQuery)) return 1;

        // Alphabetical order
        return nameA.localeCompare(nameB);
      });
  };

  const fetchSuggestions = useCallback(
    debounce(async (q) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // Try to fetch from backend autocomplete API
        const res = await fetch(
          `${API_URL}/recommendations/autocomplete?query=${encodeURIComponent(q)}`
        );
        const data = await res.json();

        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        } else {
          // Fallback to local filtering if API returns no results
          const filtered = filterDestinations(q);
          setSuggestions(filtered);
        }
      } catch (err) {
        console.error('Autocomplete API failed, using local filter:', err);
        // Fallback to local filtering if API call fails
        const filtered = filterDestinations(q);
        setSuggestions(filtered);
      } finally {
        setLoading(false);
      }
    }, 200),
    []
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    fetchSuggestions(value);
  };

  const handleSelect = (suggestion) => {
    if (allowMultiple) {
      const isAlreadySelected = selected.some(s => s.fsq_id === suggestion.fsq_id);
      if (isAlreadySelected) {
        const updated = selected.filter(s => s.fsq_id !== suggestion.fsq_id);
        setSelected(updated);
        onSelect(updated);
      } else {
        const updated = [...selected, suggestion];
        setSelected(updated);
        onSelect(updated);
      }
      setQuery('');
      setSuggestions([]);
    } else {
      setSelected(suggestion);
      setQuery(suggestion.name);
      setSuggestions([]);
      onSelect(suggestion);
    }
  };

  const handleRemove = (fsq_id) => {
    const updated = selected.filter(s => s.fsq_id !== fsq_id);
    setSelected(updated);
    onSelect(updated);
  };

  return (
    <div className="destination-search">
      <label htmlFor="destination-input">Where do you want to travel?</label>
      <input
        id="destination-input"
        type="text"
        placeholder="e.g., Bir Billing, Kyoto, Oaxaca..."
        value={query}
        onChange={handleInputChange}
        disabled={disabled}
        className="destination-input"
        autoComplete="off"
      />
      {loading && <div className="loading-spinner">Searching...</div>}
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((suggestion) => {
            const isSelected = allowMultiple && selected.some(s => s.fsq_id === suggestion.fsq_id);
            return (
              <li
                key={suggestion.fsq_id}
                onClick={() => handleSelect(suggestion)}
                className={`suggestion-item ${isSelected ? 'selected' : ''}`}
              >
                <div className="suggestion-name">{suggestion.name}</div>
                <div className="suggestion-country">{suggestion.country}</div>
                {isSelected && <div className="checkmark">✓</div>}
              </li>
            );
          })}
        </ul>
      )}
      {allowMultiple ? (
        selected.length > 0 && (
          <div className="selected-destinations">
            {selected.map((dest) => (
              <div key={dest.fsq_id} className="selected-destination-tag">
                <span>{dest.name}, {dest.country}</span>
                <button
                  className="remove-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove(dest.fsq_id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        selected && (
          <div className="selected-destination">
            <div className="checkmark">✓</div>
            <div className="selected-text">
              {selected.name}, {selected.country}
            </div>
          </div>
        )
      )}
    </div>
  );
}
