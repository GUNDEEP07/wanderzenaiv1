import React from 'react';

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
    gap: '10px',
    marginBottom: '12px',
  },
  button: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 10px',
    background: selected ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
    border: selected ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  }),
  emoji: {
    fontSize: '36px',
    lineHeight: '1',
  },
  label: (selected) => ({
    fontSize: '11px',
    color: selected ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  }),
  customButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 10px',
    background: 'rgba(0,212,170,0.08)',
    border: '2px dashed #00d4aa',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  },
  customEmoji: {
    fontSize: '36px',
    fontWeight: '300',
    color: '#00d4aa',
  },
  selectedLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '8px',
  },
  selectedSpan: {
    color: '#00d4aa',
    fontWeight: '700',
  },
};

export function ActivityGrid({ selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const handleActivityClick = (activity) => {
    onActivityToggle(activity);
  };

  return (
    <div>
      <div style={s.grid}>
        {PRESET_ACTIVITIES.map(activity => (
          <button
            key={activity.name}
            style={s.button(selectedActivities.includes(activity.name))}
            onClick={() => handleActivityClick(activity.name)}
          >
            <div style={s.emoji}>{activity.emoji}</div>
            <div style={s.label(selectedActivities.includes(activity.name))}>
              {activity.name}
            </div>
          </button>
        ))}
        <button
          style={s.customButton}
          onClick={onOpenCustomModal}
        >
          <div style={s.customEmoji}>+</div>
          <div style={s.label(false)}>Add Custom</div>
        </button>
      </div>
      <div style={s.selectedLabel}>
        <span style={s.selectedSpan}>Selected:</span> {selectedActivities.length > 0 ? selectedActivities.join(', ') : 'None'}
      </div>
    </div>
  );
}
