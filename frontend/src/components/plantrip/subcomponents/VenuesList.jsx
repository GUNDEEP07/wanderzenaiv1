import React, { useState } from 'react';
import { calculateDistance } from '../../../utils/foursquare';

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
    transition: 'all 0.2s ease',
  },
  photoContainer: {
    width: '100%',
    height: '140px',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  noPhoto: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
  },
  distanceBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(0, 212, 170, 0.9)',
    color: '#0a0f1e',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    backdropFilter: 'blur(4px)',
  },
  carouselControls: {
    position: 'absolute',
    bottom: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '4px',
    zIndex: 10,
  },
  photoDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
    padding: 0,
  },
  photoDotActive: {
    background: '#00d4aa',
    width: '8px',
    height: '8px',
  },
  carouselArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    border: 'none',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    transition: 'all 0.2s',
    zIndex: 5,
  },
  carouselArrowLeft: {
    left: '6px',
  },
  carouselArrowRight: {
    right: '6px',
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  topRankedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    fontSize: '9px',
    color: '#ffd93d',
    backgroundColor: 'rgba(255, 217, 61, 0.15)',
    padding: '2px 6px',
    borderRadius: '3px',
    fontWeight: '600',
    letterSpacing: '0.05em',
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

export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, loading, destination }) {
  const [currentPhotoIndices, setCurrentPhotoIndices] = useState({});

  const getCurrentPhotoIndex = (venueId) => currentPhotoIndices[venueId] || 0;

  const setCurrentPhotoIndex = (venueId, index) => {
    setCurrentPhotoIndices(prev => ({ ...prev, [venueId]: index }));
  };

  const goToPreviousPhoto = (e, venueId, photoCount) => {
    e.stopPropagation();
    const current = getCurrentPhotoIndex(venueId);
    const previous = current === 0 ? photoCount - 1 : current - 1;
    setCurrentPhotoIndex(venueId, previous);
  };

  const goToNextPhoto = (e, venueId, photoCount) => {
    e.stopPropagation();
    const current = getCurrentPhotoIndex(venueId);
    const next = (current + 1) % photoCount;
    setCurrentPhotoIndex(venueId, next);
  };

  const buildInstagramUrl = (instagramHandle) => {
    if (!instagramHandle) return null;
    return `https://instagram.com/${instagramHandle}`;
  };

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
            {venues.map((venue, idx) => {
              const distance = destination && venue.lat && venue.lng
                ? calculateDistance(destination.lat, destination.lng, venue.lat, venue.lng)
                : null;

              const photoCount = venue.photos ? venue.photos.length : 0;
              const currentPhotoIdx = getCurrentPhotoIndex(venue.id);
              const currentPhoto = photoCount > 0 ? venue.photos[currentPhotoIdx] : null;
              const currentPhotoUrl = currentPhoto ? `${currentPhoto.prefix}300x300${currentPhoto.suffix}` : null;

              // Show "Top Ranked" badge for top 3 venues
              const isTopRanked = idx < 3;

              return (
              <div key={venue.id} style={s.card}>
                <div style={s.photoContainer}>
                  {currentPhotoUrl ? (
                    <>
                      <img src={currentPhotoUrl} alt={venue.name} style={s.photo} />
                      {photoCount > 1 && (
                        <>
                          <button
                            style={{ ...s.carouselArrow, ...s.carouselArrowLeft }}
                            onClick={(e) => goToPreviousPhoto(e, venue.id, photoCount)}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.7)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.5)'}
                          >
                            ‹
                          </button>
                          <button
                            style={{ ...s.carouselArrow, ...s.carouselArrowRight }}
                            onClick={(e) => goToNextPhoto(e, venue.id, photoCount)}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.7)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(0,0,0,0.5)'}
                          >
                            ›
                          </button>
                          <div style={s.carouselControls}>
                            {venue.photos.map((_, idx) => (
                              <button
                                key={idx}
                                style={{
                                  ...s.photoDot,
                                  ...(idx === currentPhotoIdx ? s.photoDotActive : {})
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentPhotoIndex(venue.id, idx);
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={s.noPhoto}>📍</div>
                  )}
                  {distance && (
                    <div style={s.distanceBadge}>📏 {distance}</div>
                  )}
                </div>
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
                      <div style={s.rating}>
                        <span>⭐ {venue.rating.toFixed(1)}</span>
                        {venue.reviewCount > 0 && <span>({venue.reviewCount})</span>}
                        {isTopRanked && <div style={s.topRankedBadge}>⭐ Top Ranked</div>}
                      </div>
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
                            href={buildInstagramUrl(venue.instagramUrl)}
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
            );
            })}
          </div>
        </div>
      )}
    </>
  );
}
