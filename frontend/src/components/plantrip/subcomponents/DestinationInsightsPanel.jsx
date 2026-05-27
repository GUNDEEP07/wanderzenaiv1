import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';

const s = {
  container: {
    marginBottom: '2rem',
    padding: '20px',
    background: 'rgba(0, 212, 170, 0.08)',
    borderRadius: '16px',
    border: '1px solid rgba(0, 212, 170, 0.2)',
  },
  header: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#00d4aa',
    marginBottom: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '14px',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#00d4aa',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  cardContent: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '1.5',
  },
  loading: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px',
    padding: '12px',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '13px',
    padding: '12px',
  },
  thingsToDoList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '10px',
    marginTop: '8px',
  },
  thingToDoItem: {
    background: 'rgba(0, 212, 170, 0.1)',
    border: '1px solid rgba(0, 212, 170, 0.2)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '12px',
  },
  thingEmoji: {
    fontSize: '16px',
    marginRight: '6px',
  },
};

export function DestinationInsightsPanel({
  destination,
  travelStyles,
  startDate,
  endDate,
  loading = false,
}) {
  const [insights, setInsights] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!destination || !startDate || !endDate) return;

    const fetchInsights = async () => {
      setInsightLoading(true);
      setError(null);
      try {
        const result = await fetchDestinationInsights(
          destination.name || destination,
          travelStyles || [],
          startDate,
          endDate
        );
        setInsights(result);
      } catch (err) {
        console.error('Failed to fetch insights:', err);
        setError('Could not load destination insights');
      } finally {
        setInsightLoading(false);
      }
    };

    fetchInsights();
  }, [destination, travelStyles, startDate, endDate]);

  if (loading || insightLoading) {
    return (
      <div style={s.container}>
        <div style={s.header}>Discovering what's special...</div>
        <div style={s.loading}>Loading destination insights</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.container}>
        <div style={s.header}>Destination Insights</div>
        <div style={s.error}>{error}</div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  const destName = typeof destination === 'object' ? destination.name : destination;

  return (
    <div style={s.container}>
      <div style={s.header}>✨ Why Visit {destName} Now?</div>

      <div style={s.grid}>
        {/* Best Time to Visit */}
        <div style={s.card}>
          <div style={s.cardTitle}>🗓️ Best Months</div>
          <div style={s.cardContent}>
            <div>{insights.bestMonths?.join(', ') || 'Year-round'}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
              {insights.whyThisMonth}
            </div>
          </div>
        </div>

        {/* Weather */}
        <div style={s.card}>
          <div style={s.cardTitle}>🌤️ Weather</div>
          <div style={s.cardContent}>{insights.weather}</div>
        </div>

        {/* Crowd Level */}
        <div style={s.card}>
          <div style={s.cardTitle}>👥 Crowd Level</div>
          <div style={s.cardContent}>{insights.crowdLevel}</div>
        </div>

        {/* Travel Tip */}
        <div style={s.card}>
          <div style={s.cardTitle}>💡 Pro Tip</div>
          <div style={s.cardContent}>{insights.travelTip}</div>
        </div>

        {/* Seasonal Highlights */}
        <div style={{ ...s.card, gridColumn: 'span 1' }}>
          <div style={s.cardTitle}>🌟 Seasonal Highlights</div>
          <div style={s.cardContent}>{insights.seasonalHighlights}</div>
        </div>
      </div>

      {/* Things to Do */}
      {insights.thingsToDo && insights.thingsToDo.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={s.header}>🎯 Things to Do</div>
          <div style={s.thingsToDoList}>
            {insights.thingsToDo.map((thing, idx) => (
              <div key={idx} style={s.thingToDoItem}>
                <span style={s.thingEmoji}>{thing.emoji}</span>
                <strong>{thing.name}</strong>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                  {thing.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
