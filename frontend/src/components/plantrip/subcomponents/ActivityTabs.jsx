import React, { useState } from 'react';

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
    gap: '4px',
    padding: '16px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    overflowX: 'auto',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
    scrollBehavior: 'smooth',
    position: 'relative',
  },
  tab: (active) => ({
    padding: '10px 18px',
    background: active ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
    border: 'none',
    borderBottom: active ? '3px solid #00d4aa' : '3px solid transparent',
    borderRadius: '8px 8px 0 0',
    color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
  }),
  tabHover: {
    background: 'rgba(0,212,170,0.08)',
    color: 'rgba(255,255,255,0.8)',
  },
};

export function ActivityTabs({ selectedActivities, activeTab, onTabChange, onActivityToggle }) {
  const [hoveredTab, setHoveredTab] = useState(null);

  if (selectedActivities.length === 0) {
    return null;
  }

  return (
    <div style={s.container}>
      {selectedActivities.map(activity => {
        const isActive = activeTab === activity;
        const isHovered = hoveredTab === activity;
        return (
          <button
            key={activity}
            style={{
              ...s.tab(isActive),
              ...(isHovered && !isActive && s.tabHover),
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            onClick={() => onTabChange(activity)}
            onMouseEnter={() => setHoveredTab(activity)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <span>{ACTIVITY_EMOJIS[activity] || '📍'}</span>
            {activity}
            <span
              onClick={(e) => { e.stopPropagation(); onActivityToggle?.(activity); }}
              style={{
                marginLeft: 2, fontSize: 10, opacity: 0.5, cursor: 'pointer',
                lineHeight: 1, padding: '1px 3px', borderRadius: 3,
                background: 'rgba(255,255,255,0.08)',
              }}
              title={`Remove ${activity}`}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
