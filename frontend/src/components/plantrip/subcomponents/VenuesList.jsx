import { useState } from 'react';
import { DayList } from './DayList';

export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, onDayAssign, loading, destination, days = 5, startDate }) {
  const [openCard, setOpenCard] = useState(null);
  const [dayMap, setDayMap] = useState({});
  const [changingDay, setChangingDay] = useState(new Set());

  if (loading) {
    return (
      <div className="venue-loading">
        <span>Loading venues…</span>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div style={{ padding: '12px 0', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
        No venues found for {activity}
      </div>
    );
  }

  const handleAddClick = (e, venueId) => {
    e.stopPropagation();
    setOpenCard(openCard === venueId ? null : venueId);
  };

  const handleDaySelect = (venueId, day) => {
    setDayMap(prev => ({ ...prev, [venueId]: day }));
    if (!selectedVenues.has(venueId)) onVenueToggle(venueId);
    onDayAssign(venueId, day);
    setOpenCard(null);
    setChangingDay(prev => { const s = new Set(prev); s.delete(venueId); return s; });
  };

  const handleChangeDay = (e, venueId) => {
    e.stopPropagation();
    setChangingDay(prev => { const s = new Set(prev); s.add(venueId); return s; });
    setOpenCard(venueId);
  };

  return (
    <div>
      <div className="venue-sec-row">
        <div className="venue-sec-label">📍 Venues near {destination?.name || 'destination'}</div>
        <div className="venue-sec-line"></div>
      </div>
      <div className="venue-grid">
        {venues.map(venue => {
          const isAdded = selectedVenues.has(venue.fsq_id);
          const isOpen = openCard === venue.fsq_id;
          const assignedDay = dayMap[venue.fsq_id];
          const rating = venue.rating ? (venue.rating / 2).toFixed(1) : null;

          let cardClass = 'item-card';
          if (isAdded) cardClass += ' item-card--added';
          else if (isOpen) cardClass += ' item-card--picking';

          return (
            <div key={venue.fsq_id} className={cardClass}>
              <div className="item-card__header">
                {/* Photo thumbnail or category gradient */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: venue.photoUrl ? 'transparent' : 'rgba(0,212,170,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundImage: venue.photoUrl ? `url(${venue.photoUrl})` : 'none',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  fontSize: venue.photoUrl ? 0 : 18,
                }}>
                  {!venue.photoUrl && (venue.categories?.[0]?.icon
                    ? <img src={`${venue.categories[0].icon.prefix}32${venue.categories[0].icon.suffix}`} alt="" style={{ width: 22 }} onError={e => { e.target.style.display='none'; }} />
                    : '📍')}
                </div>
                <div className="item-card__text">
                  <div className="item-card__name">{venue.name}</div>
                  <div className="item-card__sub">{venue.categories?.[0]?.name || ''}</div>
                </div>
                <div className="item-card__actions">
                  {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                  {venue.source === 'ai' && <span className="item-ai-tag">AI</span>}
                  {rating && <span className="item-rating">⭐{rating}</span>}
                  <button
                    className={`add-btn${isAdded ? ' add-btn--done' : ''}`}
                    onClick={(e) => handleAddClick(e, venue.fsq_id)}
                  >
                    {isAdded ? '✓' : '+'}
                  </button>
                </div>
              </div>

              {(isOpen || isAdded) && (
                <div className="item-card__detail">
                  <div className="item-card__detail-body">
                    {!isAdded || changingDay.has(venue.fsq_id) ? (
                      <div>
                        {venue.description && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 8 }}>
                            {venue.description}
                          </div>
                        )}
                        {venue.openingHours && (
                          <div style={{ display: 'flex', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                            <span style={{ color: '#00d4aa' }}>🕐</span>
                            <span>{venue.openingHours}</span>
                          </div>
                        )}
                        <div className="day-list-section__label">Which day will you visit?</div>
                        <DayList
                          days={days}
                          startDate={startDate}
                          selectedDay={assignedDay || null}
                          onSelect={(day) => handleDaySelect(venue.fsq_id, day)}
                        />
                      </div>
                    ) : (
                      <div className="day-added-confirm">
                        <div className="day-added-confirm__text">
                          ✓ Added to <span className="item-day-badge" style={{ marginLeft: 4 }}>{assignedDay}</span>
                        </div>
                        <button className="day-added-confirm__change" onClick={(e) => handleChangeDay(e, venue.fsq_id)}>
                          Change day
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {venues.some(v => v.source === 'ai') && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontStyle: 'italic' }}>
          ✦ AI suggested · verify hours and availability before visiting
        </div>
      )}
    </div>
  );
}
