/** "25–26 Dec" / "30 Dec – 2 Jan" / "25 Dec" from YYYY-MM-DD dates (local calendar). */
export function formatRange(start, end) {
  const d = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? new Date(`${iso}T00:00:00`) : null);
  const a = d(start), b = d(end);
  if (!a) return '';
  const day = (x) => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!b || +a === +b) return day(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${day(b)}`;
  return `${day(a)} – ${day(b)}`;
}
