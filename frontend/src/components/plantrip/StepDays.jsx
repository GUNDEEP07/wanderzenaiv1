import { useEffect, useMemo, useState } from 'react';
import { fetchDestinationInsights } from '../../api/destinationInsights';
import { PLACE_CATEGORIES, fetchCategoryPlaces, searchPlaces, normalizePlace } from '../../api/places';
import { addDaysIso, todayIso } from '../../utils/tripDates';
import { formatRange } from '../../utils/dateRange';
import './styles/plantrip-days.css';

/**
 * Step 3 — Plan your days (Nov 2026 redesign). One tab per route stop; that stop's days
 * as boxes; a finder with "Picked for you" (destination insights), "Browse by category"
 * (Foursquare, AI for a few), search, and "add your own". Every pick carries its trip day.
 *
 * Output (form.selected_venues, version 2 — see layers/shared/nodejs/selected-venues.js):
 *   { version: 2, picks: [{ name, address, lat, lng, category, source, destination, day }], interests: [] }
 */

const dayDateLabel = (startDate, day) => {
  if (!startDate) return '';
  const iso = addDaysIso(startDate, day - 1);
  return iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
};
const rangeLabel = (stop) => (stop.toDay > stop.fromDay ? `Days ${stop.fromDay}–${stop.toDay}` : `Day ${stop.fromDay}`);
const mapsUrl = (p, stop) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address || stop.name, stop.country].filter(Boolean).join(', '))}`;
const MAX_PICKS = 40;
const keyOf = (p) => (p.id || `${p.source || 'x'}:${String(p.name).toLowerCase()}`);

export default function StepDays({ stops, startDate, travelStyles = [], value, onChange }) {
  const [stopIdx, setStopIdx] = useState(0);
  const stop = stops[Math.min(stopIdx, stops.length - 1)];
  const [targetDay, setTargetDay] = useState(stop?.fromDay || 1);
  const [mode, setMode] = useState('picked'); // 'picked' | 'browse' | 'search'
  const [category, setCategory] = useState(PLACE_CATEGORIES[0].key);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({}); // cacheKey → { loading, error, places }
  const [ownName, setOwnName] = useState('');
  const [ownDay, setOwnDay] = useState('');

  const picks = useMemo(() => (Array.isArray(value?.picks) ? value.picks : []), [value]);
  const stopDays = stop ? Array.from({ length: stop.toDay - stop.fromDay + 1 }, (_, i) => stop.fromDay + i) : [];
  const destLabel = stop ? [stop.name, stop.country].filter(Boolean).join(', ') : '';

  useEffect(() => { if (stop) { setTargetDay(stop.fromDay); setOwnDay(''); } }, [stopIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (nextPicks) => onChange({ version: 2, picks: nextPicks, interests: value?.interests || [] });
  const isPicked = (p) => picks.some(x => keyOf(x) === keyOf(p) && x.destination === destLabel);
  const add = (p, day) => {
    if (picks.length >= MAX_PICKS && !isPicked(p)) return; // the generator takes 40 at most
    const pick = {
      id: p.id || null, name: p.name, address: p.address || null,
      lat: typeof p.lat === 'number' ? p.lat : null, lng: typeof p.lng === 'number' ? p.lng : null,
      category: p.category || null, source: p.source || null, destination: destLabel, day: day || null,
    };
    save([...picks.filter(x => !(keyOf(x) === keyOf(p) && x.destination === destLabel)), pick]);
  };
  const remove = (p) => save(picks.filter(x => !(keyOf(x) === keyOf(p) && x.destination === p.destination)));

  // ── what the finder shows ──
  const cacheKey = mode === 'picked' ? `${stopIdx}|picked` : mode === 'browse' ? `${stopIdx}|cat|${category}` : `${stopIdx}|q|${query.trim().toLowerCase()}`;
  const current = results[cacheKey];

  useEffect(() => {
    if (!stop || results[cacheKey] || mode === 'search') return;
    let live = true;
    setResults(r => ({ ...r, [cacheKey]: { loading: true } }));
    (async () => {
      try {
        let places;
        if (mode === 'picked') {
          const start = startDate ? addDaysIso(startDate, stop.fromDay - 1) : addDaysIso(todayIso(), 30);
          const end = addDaysIso(start, stop.toDay - stop.fromDay);
          const insights = await fetchDestinationInsights(destLabel, travelStyles, start, end);
          places = (insights?.thingsToDo || []).map(t => ({
            ...normalizePlace({ ...t, source: t.verified ? 'foursquare' : 'ai' }, t.category),
            description: [t.reason, t.visitorTip].filter(Boolean).join(' '),
          })).filter(p => p.name);
        } else {
          places = await fetchCategoryPlaces({ name: destLabel, lat: stop.lat, lng: stop.lng }, PLACE_CATEGORIES.find(c => c.key === category));
        }
        if (live) setResults(r => ({ ...r, [cacheKey]: { places } }));
      } catch (e) {
        if (live) setResults(r => ({ ...r, [cacheKey]: { error: e.message || 'Could not load places.' } }));
      }
    })();
    return () => { live = false; };
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || !stop) return;
    setMode('search');
    const key = `${stopIdx}|q|${q.toLowerCase()}`;
    if (results[key]?.places) return;
    setResults(r => ({ ...r, [key]: { loading: true } }));
    try {
      const places = await searchPlaces({ name: destLabel, lat: stop.lat, lng: stop.lng }, q);
      setResults(r => ({ ...r, [key]: { places } }));
    } catch (err) {
      setResults(r => ({ ...r, [key]: { error: err.message || 'Search failed.' } }));
    }
  };

  const addOwn = (e) => {
    e.preventDefault();
    const name = ownName.trim().slice(0, 120);
    if (!name) return;
    add({ name, source: 'user', category: 'your pick' }, ownDay ? Number(ownDay) : null);
    setOwnName('');
  };

  if (!stop) return null;
  const stopPicks = picks.filter(p => p.destination === destLabel);
  const anyDay = stopPicks.filter(p => !p.day || !stopDays.includes(p.day));

  return (
    <div className="pd-grid">
      {/* Stops */}
      <div className="pd-stops" role="tablist" aria-label="Stops on your route">
        {stops.map((st, i) => {
          const label = [st.name, st.country].filter(Boolean).join(', ');
          const n = picks.filter(p => p.destination === label).length;
          return (
            <button key={label} type="button" role="tab" aria-selected={i === stopIdx} className={`pd-stop${i === stopIdx ? ' pd-stop--on' : ''}`} onClick={() => setStopIdx(i)}>
              <span className="pd-stop__name">{st.name}</span>
              <span className="pd-stop__days">{rangeLabel(st)}{startDate ? ` · ${formatRange(addDaysIso(startDate, st.fromDay - 1), addDaysIso(startDate, st.toDay - 1))}` : ''}</span>
              <span className="pd-stop__count">{n ? `${n} place${n > 1 ? 's' : ''}` : "Nothing yet — we'll choose"}</span>
            </button>
          );
        })}
      </div>

      {/* Days of this stop */}
      <section className="pd-days" aria-label={`Days in ${stop.name}`}>
        {stopDays.map(d => {
          const list = stopPicks.filter(p => p.day === d);
          const on = d === targetDay;
          return (
            <div key={d} className={`pd-day${on ? ' pd-day--on' : ''}`}>
              <button type="button" className="pd-day__head" aria-pressed={on} onClick={() => setTargetDay(d)}
                aria-label={`Day ${d}${startDate ? `, ${dayDateLabel(startDate, d)}` : ''}: ${list.length} place${list.length === 1 ? '' : 's'}. ${on ? 'New places go here' : 'Add new places here'}`}>
                <b>Day {d}</b>
                <span>{dayDateLabel(startDate, d)}</span>
              </button>
              <ul className="pd-day__list">
                {list.map(p => (
                  <li key={keyOf(p)} className="pd-pick">
                    <span><b>{p.name}</b>{p.category && <span className="pd-pick__cat">{p.category}</span>}</span>
                    <button type="button" className="pd-x" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}>×</button>
                  </li>
                ))}
              </ul>
              {list.length === 0 && <div className="pd-day__empty">{on ? 'Places you add go here' : 'Free — tap to fill'}</div>}
            </div>
          );
        })}
        {anyDay.length > 0 && (
          <div className="pd-day">
            <div className="pd-day__head pd-day__head--static"><b>Any day</b><span>in {stop.name}</span></div>
            <ul className="pd-day__list">
              {anyDay.map(p => (
                <li key={keyOf(p)} className="pd-pick">
                  <span><b>{p.name}</b></span>
                  <button type="button" className="pd-x" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}>×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Finder */}
      <aside className="pd-finder" aria-label={`Find things to do in ${stop.name}`}>
        <h2 className="pd-finder__title">Find things to do in {stop.name}</h2>
        <div className="pd-modes" role="tablist" aria-label="How to find places">
          <button type="button" role="tab" aria-selected={mode === 'picked'} className={`pd-mode${mode === 'picked' ? ' pd-mode--on' : ''}`} onClick={() => setMode('picked')}>Picked for you</button>
          <button type="button" role="tab" aria-selected={mode !== 'picked'} className={`pd-mode${mode !== 'picked' ? ' pd-mode--on' : ''}`} onClick={() => setMode('browse')}>Browse by category</button>
        </div>

        <form className="pd-search" role="search" onSubmit={runSearch}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label={`Search places in ${stop.name}`} placeholder="Search: banh mi, rooftop bar, temple…" maxLength={200} />
          <button type="submit" disabled={!query.trim()}>Search</button>
        </form>

        {mode !== 'picked' && (
          <div className="pd-chips" role="group" aria-label="Categories">
            {PLACE_CATEGORIES.map(c => (
              <button key={c.key} type="button" aria-pressed={mode === 'browse' && category === c.key}
                className={`pd-chip${mode === 'browse' && category === c.key ? ' pd-chip--on' : ''}`}
                onClick={() => { setCategory(c.key); setMode('browse'); }}>{c.label}</button>
            ))}
          </div>
        )}

        {mode === 'search' && <div className="pd-note">Results for “{query.trim()}” near {stop.name}</div>}

        <div aria-live="polite">
          {current?.loading && <div className="pd-note" role="status">Finding places…</div>}
          {current?.error && <div className="pd-error" role="alert">{current.error}</div>}
          {current?.places && current.places.length === 0 && (
            <div className="pd-note">Nothing found here — try another category, a search, or add your own below.</div>
          )}
        </div>

        {current?.places?.length > 0 && (
          <ul className="pd-results">
            {current.places.map(p => {
              const picked = isPicked(p);
              return (
                <li key={keyOf(p)} className="pd-result">
                  <div className="pd-result__top">
                    <b>{p.name}</b>
                    <span className={p.source === 'ai' ? 'pd-tag pd-tag--ai' : 'pd-tag'}>{p.source === 'ai' ? 'AI idea · check first' : 'Real place'}</span>
                  </div>
                  {(p.description || p.category || p.address) && (
                    <div className="pd-result__desc">{p.description || [p.category, p.address].filter(Boolean).join(' · ')}</div>
                  )}
                  <div className="pd-result__actions">
                    <a href={mapsUrl(p, stop)} target="_blank" rel="noopener noreferrer">Map</a>
                    <span style={{ flex: 1 }} />
                    {picked ? (
                      <button type="button" className="pd-add pd-add--done" onClick={() => remove({ ...p, destination: destLabel })} aria-label={`${p.name} added — remove`}>Added ✓</button>
                    ) : stopDays.length <= 3 ? stopDays.map(d => (
                      <button key={d} type="button" className="pd-add" onClick={() => add(p, d)} aria-label={`Add ${p.name} to day ${d}`}>+ Day {d}</button>
                    )) : (
                      <button type="button" className="pd-add" onClick={() => add(p, targetDay)} aria-label={`Add ${p.name} to day ${targetDay}`}>+ Day {targetDay}</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form className="pd-own" onSubmit={addOwn}>
          <label htmlFor="pd-own-name">Can't find it? Add your own place</label>
          <div className="pd-own__row">
            <input id="pd-own-name" type="text" value={ownName} onChange={e => setOwnName(e.target.value)} placeholder="e.g. my friend's café on Bạch Đằng" maxLength={120} />
            <select aria-label="Day" value={ownDay} onChange={e => setOwnDay(e.target.value)}>
              <option value="">Any day</option>
              {stopDays.map(d => <option key={d} value={d}>Day {d}</option>)}
            </select>
            <button type="submit" disabled={!ownName.trim()}>Add</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/** "3 places on 2 of 5 days" for the footer. */
export function daysStatus(selection, days) {
  const picks = Array.isArray(selection?.picks) ? selection.picks : [];
  if (!picks.length) return "Optional — skip and we'll plan every day";
  const dayCount = new Set(picks.map(p => p.day).filter(Boolean)).size;
  return `${picks.length} place${picks.length > 1 ? 's' : ''}${dayCount ? ` on ${dayCount} of ${days} days` : ''} · we'll plan the rest`;
}
