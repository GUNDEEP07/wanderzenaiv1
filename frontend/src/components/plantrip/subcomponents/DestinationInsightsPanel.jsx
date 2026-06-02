import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';
import { DayList } from './DayList';

const CATEGORY_COLOURS = {
  'Food':      'rgba(251,146,60,0.5)',
  'Culture':   'rgba(167,139,250,0.5)',
  'Nature':    'rgba(52,211,153,0.5)',
  'Adventure': 'rgba(34,197,94,0.5)',
  'Wellness':  'rgba(251,113,133,0.5)',
  'Nightlife': 'rgba(129,90,213,0.5)',
  'Hiking':    'rgba(34,197,94,0.5)',
  'Views':     'rgba(96,165,250,0.5)',
};

export function DestinationInsightsPanel({
  destination,
  travelStyles,
  startDate,
  endDate,
  selectedActivities = [],
  onActivityToggle,
  onInsightsLoaded,
  onDayAssign,
  days = 5,
}) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [dayMap, setDayMap] = useState({});
  const [changingDay, setChangingDay] = useState(new Set());

  const destName = typeof destination === 'object' ? destination?.name : destination;

  useEffect(() => {
    if (!destination || !startDate || !endDate) return;
    let cancelled = false;
    const loadInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDestinationInsights(destName, travelStyles || [], startDate, endDate);
        if (cancelled) return;
        setInsights(result);
        if (result.thingsToDo) onInsightsLoaded?.(result.thingsToDo);
      } catch (err) {
        if (!cancelled) setError('Could not load destination insights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInsights();
    return () => { cancelled = true; };
  }, [destination, travelStyles, startDate, endDate]);

  if (!destination) return null;

  if (loading) {
    return (
      <div className="insights-strip">
        <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
        <div className="insights-strip__badges">
          <span className="insights-badge">Loading insights…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-strip insights-strip--error">
        <span className="insights-strip__error-text">{error}</span>
      </div>
    );
  }

  if (!insights) return null;

  const bestMonthsText = insights.bestMonths?.slice(0, 2).join(' & ') || 'Year-round';
  const weatherShort = insights.weather ? insights.weather.split(/[,(]/)[0].trim() : null;

  const handleChevronClick = (e, name) => {
    e.stopPropagation();
    setOpenCard(prev => prev === name ? null : name);
  };

  const handleAddClick = (e, name) => {
    e.stopPropagation();
    if (!selectedActivities.includes(name)) {
      setOpenCard(prev => prev === name ? null : name);
    }
  };

  const handleDaySelect = (name, day) => {
    setDayMap(prev => ({ ...prev, [name]: day }));
    if (!selectedActivities.includes(name)) onActivityToggle?.(name);
    onDayAssign?.(name, day);
    setOpenCard(null);
    setChangingDay(prev => { const s = new Set(prev); s.delete(name); return s; });
  };

  const handleChangeDay = (e, name) => {
    e.stopPropagation();
    setChangingDay(prev => { const s = new Set(prev); s.add(name); return s; });
    setOpenCard(name);
  };

  return (
    <div>
      {/* Compact insight badges */}
      <div className="insights-strip" style={{ marginBottom: 14 }}>
        <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
        <div className="insights-strip__badges">
          {weatherShort && <span className="insights-badge insights-badge--weather">☀️ {weatherShort}</span>}
          {insights.crowdLevel && <span className="insights-badge insights-badge--crowd">👥 {insights.crowdLevel}</span>}
          <span className="insights-badge insights-badge--months">🗓️ {bestMonthsText}</span>
        </div>
      </div>

      {insights.thingsToDo?.length > 0 && (
        <div>
          <div className="venue-picks-label">
            <span className="venue-picks-label__text">✦ Curated for you</span>
            <div className="venue-picks-label__line"></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insights.thingsToDo.map((thing) => {
              const isAdded = selectedActivities.includes(thing.name);
              const isOpen = openCard === thing.name;
              const assignedDay = dayMap[thing.name];
              const segment = thing.reason ? thing.reason.split('—')[0].trim() : '';
              const reasonShort = segment.length > 55 ? segment.slice(0, 55) + '…' : segment;

              let cardClass = 'item-card';
              if (isAdded) cardClass += ' item-card--added';
              else if (isOpen) cardClass += ' item-card--picking';

              return (
                <div key={thing.name} className={cardClass}>
                  {/* Header — always visible */}
                  <div className="item-card__header" onClick={(e) => handleChevronClick(e, thing.name)} style={{ cursor: 'pointer' }}>
                    <div className="item-card__icon">{thing.emoji}</div>
                    <div className="item-card__text">
                      <div className="item-card__name">{thing.name}</div>
                      <div className="item-card__sub">{reasonShort}</div>
                    </div>
                    <div className="item-card__actions">
                      {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                      <button
                        className={`add-btn${isAdded ? ' add-btn--done' : ''}`}
                        onClick={(e) => handleAddClick(e, thing.name)}
                      >
                        {isAdded ? '✓' : '+'}
                      </button>
                      <div
                        className="item-chevron"
                        onClick={(e) => handleChevronClick(e, thing.name)}
                      >
                        ▾
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail — shown when open or added */}
                  {(isOpen || isAdded) && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px 12px' }}>

                      {/* Venue photo */}
                      {thing.unsplashKeyword && (
                        <img
                          src={`https://source.unsplash.com/320x200/?${encodeURIComponent(thing.unsplashKeyword)}`}
                          alt={thing.name}
                          loading="lazy"
                          style={{
                            width: '100%', height: 120, objectFit: 'cover',
                            borderRadius: 8, marginBottom: 10, display: 'block',
                          }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      )}

                      {/* Category colour bar */}
                      <div style={{
                        height: 3, borderRadius: 2, marginBottom: 10,
                        background: CATEGORY_COLOURS[thing.category] || 'rgba(0,212,170,0.4)',
                      }} />

                      {/* Why visit */}
                      {thing.reason && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 10 }}>
                          {thing.reason}
                        </div>
                      )}

                      {/* Meta details */}
                      {(thing.openingHours || thing.distanceFromCenter || thing.bestTime) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                          {thing.openingHours && (
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                              <span style={{ color: '#00d4aa', flexShrink: 0 }}>🕐</span>
                              <span>{thing.openingHours}</span>
                            </div>
                          )}
                          {thing.distanceFromCenter && (
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                              <span style={{ color: '#00d4aa', flexShrink: 0 }}>📍</span>
                              <span>{thing.distanceFromCenter}</span>
                            </div>
                          )}
                          {thing.bestTime && (
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                              <span style={{ color: '#ffd93d', flexShrink: 0 }}>✨</span>
                              <span>{thing.bestTime}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Insider tip */}
                      {thing.visitorTip && (
                        <div style={{
                          marginBottom: 10, padding: '6px 8px',
                          background: 'rgba(0,212,170,0.06)', borderRadius: 7,
                          border: '1px solid rgba(0,212,170,0.15)',
                          fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
                        }}>
                          💡 {thing.visitorTip}
                        </div>
                      )}

                      {/* Category tag */}
                      {thing.category && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span className="item-tag">{thing.category}</span>
                        </div>
                      )}

                      {/* Google Maps link */}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(thing.name + ' ' + destName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, color: '#60a5fa', textDecoration: 'none',
                          marginBottom: 10,
                        }}
                      >
                        📍 View on Google Maps →
                      </a>

                      {/* Day picker or confirmation */}
                      {!isAdded || changingDay.has(thing.name) ? (
                        <div>
                          <div className="day-list-section__label">Which day will you visit?</div>
                          <DayList
                            days={days}
                            startDate={startDate}
                            selectedDay={assignedDay || null}
                            onSelect={(day) => handleDaySelect(thing.name, day)}
                          />
                        </div>
                      ) : (
                        <div className="day-added-confirm">
                          <div className="day-added-confirm__text">
                            ✓ Added to <span className="item-day-badge" style={{ marginLeft: 4 }}>{assignedDay}</span>
                          </div>
                          <button className="day-added-confirm__change" onClick={(e) => handleChangeDay(e, thing.name)}>
                            Change day
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
