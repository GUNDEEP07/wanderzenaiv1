import { useState, useCallback } from 'react';
import { debounce } from 'lodash';
import './styles/destinationsearch.css';

const API_URL = import.meta.env.VITE_API_URL;

export function DestinationSearch({ onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchSuggestions = useCallback(
    debounce(async (q) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/autocomplete?query=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Autocomplete failed:', err);
        // Fallback suggestions for local testing
        setSuggestions([
          { fsq_id: 'kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
          { fsq_id: 'bangkok', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
          { fsq_id: 'bali', name: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
          { fsq_id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
          { fsq_id: 'oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lng: -96.7266 },
        ]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    fetchSuggestions(value);
  };

  const handleSelect = (suggestion) => {
    setSelected(suggestion);
    setQuery(suggestion.name);
    setSuggestions([]);
    onSelect(suggestion);
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
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.fsq_id}
              onClick={() => handleSelect(suggestion)}
              className="suggestion-item"
            >
              <div className="suggestion-name">{suggestion.name}</div>
              <div className="suggestion-country">{suggestion.country}</div>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="selected-destination">
          <div className="checkmark">✓</div>
          <div className="selected-text">
            {selected.name}, {selected.country}
          </div>
        </div>
      )}
    </div>
  );
}
