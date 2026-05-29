import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';
import { DayList } from './DayList';

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
      <div className="insights-strip" style={{ marginBottom: 12 }}>
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
                  <div className="item-card__header">
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

                  {(isOpen || isAdded) && (
                    <div className="item-card__detail" style={{ maxHeight: 480 }}>
                      <div className="item-card__detail-body">

                        {/* Unsplash photo */}
                        {thing.unsplashKeyword && (
                          <div style={{
                            height: 100, borderRadius: 8, marginBottom: 10, overflow: 'hidden',
                            background: 'rgba(255,255,255,0.04)',
                            backgroundImage: `url(https://source.unsplash.com/featured/320x100?${encodeURIComponent(thing.unsplashKeyword)})`,
                            backgroundSize: 'cover', backgroundPosition: 'center',
                          }} />
                        )}

                        {/* Why visit */}
                        {thing.reason && (
                          <div className="item-card__desc">{thing.reason}</div>
                        )}

                        {/* Meta details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '8px 0 10px' }}>
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
                          {thing.visitorTip && (
                            <div style={{
                              marginTop: 4, padding: '6px 8px',
                              background: 'rgba(0,212,170,0.06)', borderRadius: 7,
                              border: '1px solid rgba(0,212,170,0.15)',
                              fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
                            }}>
                              💡 {thing.visitorTip}
                            </div>
                          )}
                        </div>

                        {/* Category + day tags */}
                        {thing.category && (
                          <div className="item-card__tags">
                            <span className="item-tag">{thing.category}</span>
                          </div>
                        )}

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
