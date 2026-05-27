import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';

export function DestinationInsightsPanel({
  destination,
  travelStyles,
  startDate,
  endDate,
  selectedActivities = [],
  onActivityToggle,
  onInsightsLoaded,
}) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const destName = typeof destination === 'object' ? destination?.name : destination;

  useEffect(() => {
    if (!destination || !startDate || !endDate) return;
    let cancelled = false;
    const loadInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDestinationInsights(
          destName,
          travelStyles || [],
          startDate,
          endDate
        );
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
  const weatherShort = insights.weather
    ? insights.weather.split(/[,(]/)[0].trim()
    : null;

  return (
    <div className="insights-strip">
      <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
      <div className="insights-strip__badges">
        {weatherShort && (
          <span className="insights-badge insights-badge--weather">☀️ {weatherShort}</span>
        )}
        {insights.crowdLevel && (
          <span className="insights-badge insights-badge--crowd">👥 {insights.crowdLevel}</span>
        )}
        <span className="insights-badge insights-badge--months">🗓️ {bestMonthsText}</span>
      </div>

      {insights.thingsToDo?.length > 0 && (
        <div className="ai-suggestions">
          <div className="ai-suggestions__label">AI Picks — tap to add</div>
          <div className="ai-suggestion-list">
            {insights.thingsToDo.map((thing) => {
              const isSelected = selectedActivities.includes(thing.name);
              const segment = thing.reason ? thing.reason.split('—')[0].trim() : '';
              const reasonShort = segment.length > 55 ? segment.slice(0, 55) + '…' : segment;
              return (
                <button
                  key={thing.name}
                  className={`ai-suggestion-card${isSelected ? ' ai-suggestion-card--selected' : ''}`}
                  onClick={() => onActivityToggle?.(thing.name)}
                >
                  <span className="ai-suggestion-card__emoji">{thing.emoji}</span>
                  <div className="ai-suggestion-card__info">
                    <div className="ai-suggestion-card__name">{thing.name}</div>
                    <div className="ai-suggestion-card__reason">{reasonShort}</div>
                  </div>
                  {isSelected && <span className="ai-suggestion-card__check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
