/**
 * Day picker for one stop of the route: `days` rows starting at trip day `firstDay`.
 * `startDate` (YYYY-MM-DD) is the date of `firstDay`; rows show their dates when given.
 * onSelect receives the label ("Day 3"), which VenueSelection turns into a day number.
 */
export function DayList({ days, firstDay = 1, startDate, selectedDay, onSelect }) {
  const base = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(`${startDate}T00:00:00`) : null;
  const rows = Array.from({ length: Math.max(0, days) }, (_, i) => {
    const label = `Day ${firstDay + i}`;
    let dateStr = '';
    if (base && !Number.isNaN(base.getTime())) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    return { label, dateStr };
  });

  return (
    <div className="day-list" role="group" aria-label="Pick a day">
      {rows.map(({ label, dateStr }) => {
        const chosen = selectedDay === label;
        return (
          <button
            type="button"
            key={label}
            aria-pressed={chosen}
            className={`day-list__row${chosen ? ' day-list__row--chosen' : ''}`}
            onClick={() => onSelect?.(label)}
          >
            <span className="day-list__num">{label}</span>
            {dateStr && <span className="day-list__date">{dateStr}</span>}
            <span className="day-list__tick" aria-hidden="true">{chosen ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
