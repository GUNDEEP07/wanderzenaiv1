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

const IMAGE_MAP = {
  'Hiking':    'https://images.unsplash.com/photo-1551632811-561732d1e306?w=160&h=100&fit=crop&auto=format',
  'Food':      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=160&h=100&fit=crop&auto=format',
  'Views':     'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=160&h=100&fit=crop&auto=format',
  'Culture':   'https://images.unsplash.com/photo-1555212697-194d092e3b8f?w=160&h=100&fit=crop&auto=format',
  'Nature':    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=160&h=100&fit=crop&auto=format',
  'Nightlife': 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=160&h=100&fit=crop&auto=format',
  'Wellness':  'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=160&h=100&fit=crop&auto=format',
  'Parks':     'https://images.unsplash.com/photo-1515169067868-5387ec356754?w=160&h=100&fit=crop&auto=format',
  'Adventure': 'https://images.unsplash.com/photo-1527004013197-933b832f792a?w=160&h=100&fit=crop&auto=format',
  'Beaches':   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&h=100&fit=crop&auto=format',
  'Markets':   'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=160&h=100&fit=crop&auto=format',
  'Museums':   'https://images.unsplash.com/photo-1582071379394-b4e2a81c30a4?w=160&h=100&fit=crop&auto=format',
};

export function ActivityGrid({ availableActivities, selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const activities = (availableActivities || []).map(name => ({
    name,
    emoji: EMOJI_MAP[name] || '📍',
    colourKey: COLOUR_CLASS[name] || 'default',
    image: IMAGE_MAP[name] || null,
  }));

  return (
    <div className="activity-grid">
      {activities.map(({ name, emoji, colourKey, image }) => {
        const selected = selectedActivities.includes(name);
        return (
          <button
            key={name}
            className={`activity-card activity-card--${colourKey}${selected ? ' activity-card--selected' : ''}`}
            onClick={() => onActivityToggle(name)}
            style={image ? {
              backgroundImage: `linear-gradient(to bottom, rgba(6,9,15,0.1) 0%, rgba(6,9,15,0.75) 100%), url(${image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
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
