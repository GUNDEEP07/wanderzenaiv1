/** One marker per distinct town; a town visited twice (Hanoi → Sapa → Hanoi) is labelled "1 · 3". */
export function markerGroups(stops) {
  const groups = [];
  stops.forEach((s, i) => {
    const key = `${s.name}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
    const g = groups.find(x => x.key === key);
    if (g) g.numbers.push(i + 1);
    else groups.push({ key, name: s.name, lat: s.lat, lng: s.lng, numbers: [i + 1], index: i });
  });
  return groups;
}
