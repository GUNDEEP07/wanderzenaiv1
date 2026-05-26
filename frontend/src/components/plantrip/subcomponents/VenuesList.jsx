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
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    height: '120px',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px',
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
  attributes: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  attributeIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '9px',
    color: 'rgba(0,212,170,0.7)',
    backgroundColor: 'rgba(0,212,170,0.1)',
    padding: '3px 6px',
    borderRadius: '4px',
  },
  hoursInfo: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  links: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '10px',
    color: '#00d4aa',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  address: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '4px',
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
              <div key={venue.id} style={s.card}>
                {venue.photoUrl && (
                  <div style={s.photoContainer}>
                    <img src={venue.photoUrl} alt={venue.name} style={s.photo} />
                  </div>
                )}
                <label style={s.cardContent}>
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
                    {venue.attributes && (
                      <div style={s.attributes}>
                        {venue.attributes.wifi && (
                          <div style={s.attributeIcon}>📶 WiFi</div>
                        )}
                        {venue.attributes.parking && (
                          <div style={s.attributeIcon}>🅿️ Parking</div>
                        )}
                        {venue.attributes.outdoor_seating && (
                          <div style={s.attributeIcon}>🪑 Outdoor</div>
                        )}
                        {venue.attributes.restroom && (
                          <div style={s.attributeIcon}>🚻 Restroom</div>
                        )}
                        {venue.attributes.delivery && (
                          <div style={s.attributeIcon}>🚚 Delivery</div>
                        )}
                        {venue.attributes.reservations && (
                          <div style={s.attributeIcon}>📅 Reservations</div>
                        )}
                      </div>
                    )}
                    {venue.hours && (
                      <div style={s.hoursInfo}>
                        {venue.hours.open_now ? '🟢 Open now' : '🔴 Closed'} {venue.hours.display && `• ${venue.hours.display}`}
                      </div>
                    )}
                    {venue.address && (
                      <div style={s.address}>{venue.address}</div>
                    )}
                    {(venue.instagramUrl || venue.website || venue.tel) && (
                      <div style={s.links}>
                        {venue.instagramUrl && (
                          <a
                            href={venue.instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={s.link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            📷 Instagram
                          </a>
                        )}
                        {venue.website && (
                          <a
                            href={venue.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={s.link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            🌐 Website
                          </a>
                        )}
                        {venue.tel && (
                          <a
                            href={`tel:${venue.tel}`}
                            style={s.link}
                            onClick={(e) => e.stopPropagation()}
                          >
                            📞 Call
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
