import React, { useState } from 'react';

const PRESET_ACTIVITIES = [
  { name: 'Hiking', emoji: '🥾' },
  { name: 'Food', emoji: '🍜' },
  { name: 'Views', emoji: '⛰️' },
  { name: 'Culture', emoji: '🏛️' },
  { name: 'Nature', emoji: '🌳' },
  { name: 'Nightlife', emoji: '🎵' },
];

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '14px',
    marginBottom: '16px',
  },
  button: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '18px 12px',
    background: selected ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.05)',
    border: selected ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.15)',
    borderRadius: '16px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: selected ? 'scale(1.05)' : 'scale(1)',
    boxShadow: selected ? '0 8px 24px rgba(0,212,170,0.15)' : '0 2px 8px rgba(0,0,0,0.2)',
    position: 'relative',
    overflow: 'hidden',
  }),
  buttonHover: {
    transform: 'scale(1.08)',
    boxShadow: '0 8px 24px rgba(0,212,170,0.2)',
  },
  emoji: {
    fontSize: '40px',
    lineHeight: '1',
    transition: 'transform 0.3s ease',
  },
  checkmark: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '16px',
    background: '#00d4aa',
    color: '#0a0f1e',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    animation: 'popIn 0.3s ease',
  },
  label: (selected) => ({
    fontSize: '12px',
    color: selected ? '#00d4aa' : 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textAlign: 'center',
    transition: 'color 0.3s ease',
  }),
  customButton: (isHovered) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '18px 12px',
    background: 'rgba(139, 92, 246, 0.12)',
    border: '2px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '16px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isHovered ? '0 8px 24px rgba(139, 92, 246, 0.2)' : '0 2px 8px rgba(0,0,0,0.2)',
    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
  }),
  customEmoji: {
    fontSize: '40px',
    fontWeight: '300',
    color: '#a85cf6',
  },
  selectedLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '12px',
    fontWeight: '500',
  },
  selectedSpan: {
    color: '#00d4aa',
    fontWeight: '700',
  },
};

export function ActivityGrid({ selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const [hoveredButton, setHoveredButton] = useState(null);

  const handleActivityClick = (activity) => {
    onActivityToggle(activity);
  };

  return (
    <div>
      <style>{`
        @keyframes popIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div style={s.grid}>
        {PRESET_ACTIVITIES.map(activity => {
          const isSelected = selectedActivities.includes(activity.name);
          const isHovered = hoveredButton === activity.name;
          return (
            <button
              key={activity.name}
              style={{
                ...s.button(isSelected),
                ...(isHovered && s.buttonHover),
              }}
              onClick={() => handleActivityClick(activity.name)}
              onMouseEnter={() => setHoveredButton(activity.name)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              {isSelected && <div style={s.checkmark}>✓</div>}
              <div style={s.emoji}>{activity.emoji}</div>
              <div style={s.label(isSelected)}>
                {activity.name}
              </div>
            </button>
          );
        })}
        <button
          style={s.customButton(hoveredButton === 'custom')}
          onClick={onOpenCustomModal}
          onMouseEnter={() => setHoveredButton('custom')}
          onMouseLeave={() => setHoveredButton(null)}
        >
          <div style={s.customEmoji}>✨</div>
          <div style={s.label(false)}>Add Custom</div>
        </button>
      </div>
      <div style={s.selectedLabel}>
        <span style={s.selectedSpan}>Selected:</span> {selectedActivities.length > 0 ? selectedActivities.join(', ') : 'None'}
      </div>
    </div>
  );
}
