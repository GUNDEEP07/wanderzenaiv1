import React from 'react';

const s = {
  section: {
    marginTop: '20px',
    animation: 'fadeIn 0.5s ease-out',
  },
  header: {
    fontSize: '10px',
    color: '#00d4aa',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
    accentColor: '#00d4aa',
    flexShrink: 0,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
  },
  category: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '2px',
  },
  rating: {
    fontSize: '11px',
    color: '#ffd93d',
    marginTop: '4px',
  },
  social: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px',
  },
  instagramLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: '#00d4aa',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '14px',
  },
};

export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, loading }) {
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      {loading ? (
        <div style={s.section}>
          <div style={s.header}>🎯 Top {activity} Spots</div>
          <div style={s.loading}>Loading venues...</div>
        </div>
      ) : !venues || venues.length === 0 ? (
        <div style={s.section}>
          <div style={s.header}>🎯 Top {activity} Spots</div>
          <div style={s.empty}>No venues found for {activity}</div>
        </div>
      ) : (
        <div style={s.section}>
          <div style={s.header}>🎯 Top {activity} Spots ({venues.length} available)</div>

          <div style={s.list}>
            {venues.map(venue => (
              <label key={venue.id} style={s.label}>
                <input
                  type="checkbox"
                  style={s.checkbox}
                  checked={selectedVenues.has(venue.id)}
                  onChange={() => onVenueToggle(venue.id)}
                />
                <div style={s.info}>
                  <div style={s.name}>{venue.name}</div>
                  {venue.category && (
                    <div style={s.category}>{venue.category}</div>
                  )}
                  {venue.rating && (
                    <div style={s.rating}>⭐ {venue.rating.toFixed(1)}</div>
                  )}
                  {venue.instagramUrl && (
                    <div style={s.social}>
                      <a
                        href={venue.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={s.instagramLink}
                        onClick={(e) => e.stopPropagation()}
                      >
                        📷 Instagram
                      </a>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
