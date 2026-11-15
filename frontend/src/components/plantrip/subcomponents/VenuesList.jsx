import { useState } from 'react';
import { DayList } from './DayList';

/** Venues reach this list as { id } (utils/foursquare.js, search) — older code used fsq_id. */
const venueId = (venue) => venue.id ?? venue.fsq_id;

const mapsUrl = (venue, destination) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  [venue.name, venue.address && venue.address !== 'Address not available' ? venue.address : destination?.name].filter(Boolean).join(', '),
)}`;

/**
 * Venues for one category or search. Tap + to pick a day (only this stop's days are offered);
 * the venue is added with that day. `firstDay` is the trip day the stop starts on and
 * `startDate` that day's date.
 */
export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, onDayAssign, loading, destination, days = 5, firstDay = 1, startDate }) {
  const [openCard, setOpenCard] = useState(null);
  const [dayMap, setDayMap] = useState({});
  const [changingDay, setChangingDay] = useState(new Set());

  if (loading) {
    return (
      <div className="venue-loading" role="status">
        <span>Finding places…</span>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', background: 'rgba(0,212,170,0.03)', border: '1px solid rgba(0,212,170,0.1)', borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
          No {activity ? `${activity.toLowerCase()} ` : ''}places found near {destination?.name?.split(',')[0] || 'here'}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
          Try the search box with something specific, or pick another category.
        </div>
      </div>
    );
  }

  const handleAddClick = (e, id) => {
    e.stopPropagation();
    setOpenCard(openCard === id ? null : id);
  };

  const handleDaySelect = (id, day) => {
    setDayMap(prev => ({ ...prev, [id]: day }));
    if (!selectedVenues.has(id)) onVenueToggle(id);
    onDayAssign(id, day);
    setOpenCard(null);
    setChangingDay(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleRemove = (e, id) => {
    e.stopPropagation();
    if (selectedVenues.has(id)) onVenueToggle(id);
    setDayMap(prev => { const next = { ...prev }; delete next[id]; return next; });
    onDayAssign(id, undefined);
    setOpenCard(null);
  };

  const handleChangeDay = (e, id) => {
    e.stopPropagation();
    setChangingDay(prev => { const s = new Set(prev); s.add(id); return s; });
    setOpenCard(id);
  };

  return (
    <div>
      <div className="venue-sec-row">
        <div className="venue-sec-label">Places near {destination?.name?.split(',')[0] || 'here'}</div>
        <div className="venue-sec-line"></div>
      </div>
      <div className="venue-grid">
        {venues.map(venue => {
          const id = venueId(venue);
          if (id == null) return null;
          const isAdded = selectedVenues.has(id);
          const isOpen = openCard === id;
          const assignedDay = dayMap[id];
          const rating = venue.rating ? (venue.rating / 2).toFixed(1) : null;
          const sub = [venue.category, venue.address && venue.address !== 'Address not available' ? venue.address : null].filter(Boolean).join(' · ');

          let cardClass = 'item-card';
          if (isAdded) cardClass += ' item-card--added';
          else if (isOpen) cardClass += ' item-card--picking';

          return (
            <div key={id} className={cardClass}>
              <div className="item-card__header">
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
                  background: venue.photoUrl ? `center / cover no-repeat url(${JSON.stringify(venue.photoUrl)})` : 'rgba(0,212,170,0.1)',
                }} aria-hidden="true" />
                <div className="item-card__text">
                  <div className="item-card__name">{venue.name}</div>
                  {sub && <div className="item-card__sub">{sub}</div>}
                </div>
                <div className="item-card__actions">
                  {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                  {venue.source === 'ai' && <span className="item-ai-tag">AI</span>}
                  {rating && <span className="item-rating">★ {rating}</span>}
                  <button
                    type="button"
                    className={`add-btn${isAdded ? ' add-btn--done' : ''}`}
                    aria-label={isAdded ? `${venue.name}: added${assignedDay ? ` on ${assignedDay}` : ''}. Show options` : `Add ${venue.name} to a day`}
                    aria-expanded={isOpen || isAdded}
                    onClick={(e) => handleAddClick(e, id)}
                  >
                    {isAdded ? '✓' : '+'}
                  </button>
                </div>
              </div>

              {(isOpen || isAdded) && (
                <div className="item-card__detail">
                  <div className="item-card__detail-body">
                    {venue.description && (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 8 }}>{venue.description}</div>
                    )}
                    {venue.openingHours && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>Hours: {venue.openingHours}</div>
                    )}
                    <a href={mapsUrl(venue, destination)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-block', fontSize: 13, color: '#5eead4', marginBottom: 10 }}>
                      View on Google Maps
                    </a>
                    {!isAdded || changingDay.has(id) ? (
                      <div>
                        <div className="day-list-section__label">Which day will you visit?</div>
                        <DayList
                          days={days}
                          firstDay={firstDay}
                          startDate={startDate}
                          selectedDay={assignedDay || null}
                          onSelect={(day) => handleDaySelect(id, day)}
                        />
                      </div>
                    ) : (
                      <div className="day-added-confirm">
                        <div className="day-added-confirm__text">
                          ✓ Added{assignedDay ? <> to <span className="item-day-badge" style={{ marginLeft: 4 }}>{assignedDay}</span></> : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button type="button" className="day-added-confirm__change" onClick={(e) => handleChangeDay(e, id)}>Change day</button>
                          <button type="button" className="day-added-confirm__change" onClick={(e) => handleRemove(e, id)}>Remove</button>
                        </div>
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
        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontStyle: 'italic' }}>
          AI suggested · check hours before you go
        </div>
      )}
    </div>
  );
}
