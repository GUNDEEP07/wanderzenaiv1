import React from 'react';

const ACTIVITY_EMOJIS = {
  'Hiking': '🥾',
  'Food': '🍜',
  'Views': '⛰️',
  'Culture': '🏛️',
  'Nature': '🌳',
  'Nightlife': '🎵',
};

const s = {
  container: {
    display: 'flex',
    gap: '8px',
    padding: '12px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    overflowX: 'auto',
    background: 'rgba(255,255,255,0.02)',
    scrollBehavior: 'smooth',
  },
  tab: (active) => ({
    padding: '8px 14px',
    background: active ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  }),
};

export function ActivityTabs({ selectedActivities, activeTab, onTabChange }) {
  if (selectedActivities.length === 0) {
    return null;
  }

  return (
    <div style={s.container}>
      {selectedActivities.map(activity => (
        <button
          key={activity}
          style={s.tab(activeTab === activity)}
          onClick={() => onTabChange(activity)}
        >
          {ACTIVITY_EMOJIS[activity] || '📍'} {activity}
        </button>
      ))}
    </div>
  );
}
