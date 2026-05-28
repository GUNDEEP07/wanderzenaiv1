export function DayList({ days, startDate, selectedDay, onSelect }) {
  const rows = Array.from({ length: days }, (_, i) => {
    const label = `Day ${i + 1}`;
    let dateStr = '';
    if (startDate) {
      const base = new Date(startDate);
      if (!isNaN(base)) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      }
    }
    return { label, dateStr };
  });

  return (
    <div className="day-list">
      {rows.map(({ label, dateStr }) => {
        const chosen = selectedDay === label;
        return (
          <button
            key={label}
            className={`day-list__row${chosen ? ' day-list__row--chosen' : ''}`}
            onClick={() => onSelect?.(label)}
          >
            <span className="day-list__num">{label}</span>
            {dateStr && <span className="day-list__date">{dateStr}</span>}
            <span className="day-list__tick">{chosen ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
