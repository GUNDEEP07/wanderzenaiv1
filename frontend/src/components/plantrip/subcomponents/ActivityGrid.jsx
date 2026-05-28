const EMOJI_MAP = {
  'Hiking':'🥾','Food':'🍜','Views':'⛰️','Culture':'🏛️','Nature':'🌳',
  'Nightlife':'🎵','Wellness':'🧘','Parks':'🌲','Spa':'🧘','Adventure':'🚀',
  'Beaches':'🏖️','Shopping':'🛍️','Markets':'🏪','Museums':'🖼️',
  'Restaurants':'🍽️','Cafes':'☕','Sports':'⚽','Landmarks':'🗽',
};

const COLOUR_CLASS = {
  'Hiking':'hiking','Food':'food','Views':'views','Culture':'culture',
  'Nature':'nature','Nightlife':'nightlife','Wellness':'wellness',
};

export function ActivityGrid({ availableActivities, selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const activities = (availableActivities || []).map(name => ({
    name,
    emoji: EMOJI_MAP[name] || '📍',
    colourKey: COLOUR_CLASS[name] || 'default',
  }));

  return (
    <div className="activity-grid">
      {activities.map(({ name, emoji, colourKey }) => {
        const selected = selectedActivities.includes(name);
        return (
          <button
            key={name}
            className={`activity-card activity-card--${colourKey}${selected ? ' activity-card--selected' : ''}`}
            onClick={() => onActivityToggle(name)}
          >
            <span className="activity-card__emoji">{emoji}</span>
            <div className="activity-card__label">{name}</div>
          </button>
        );
      })}
      <button
        className="activity-card activity-card--custom"
        onClick={onOpenCustomModal}
      >
        <span className="activity-card__emoji">✨</span>
        <div className="activity-card__label">Add own</div>
      </button>
    </div>
  );
}
