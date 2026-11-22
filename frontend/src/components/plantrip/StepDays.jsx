import { useEffect, useMemo, useState } from 'react';
import { searchPlaces, normalizePlace } from '../../api/places';
import { stopInsights } from '../../api/stopInsights';
import { CreditedPhoto } from '../PhotoCredit';
import './styles/plantrip-mustsee.css';

/**
 * Step 3 — "Anything you don't want to miss?" (must-see list, chosen by Gundeep Nov 22 2026;
 * replaces the day boxes + four-way finder, which was slow and felt compulsory).
 *
 * Every stop on the route gets a short list of ideas at once: the route's own day trips (instant)
 * and six places from destination insights (Foursquare-grounded, cached per travel month), all
 * stops loading in parallel. The traveller taps Keep; the generator fits kept places into the
 * right day, so picks carry no day (day: null = "any day at this stop"). "Add your own" searches
 * that stop or adds a name as written. Skipping is a first-class choice.
 *
 * Output (form.selected_venues, version 2 — see layers/shared/nodejs/selected-venues.js):
 *   { version: 2, picks: [{ name, address, lat, lng, category, source, destination, day }], interests: [] }
 */

const MAX_PICKS = 40;
const keyOf = (p) => String(p.id || `${p.source || 'x'}:${String(p.name).toLowerCase()}`);
const nameKey = (p) => String(p.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
const labelOf = (stop) => [stop.name, stop.country].filter(Boolean).join(', ');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const rangeLabel = (stop) => (stop.toDay > stop.fromDay ? `Days ${stop.fromDay}–${stop.toDay}` : `Day ${stop.fromDay}`);
const mapsUrl = (p, stop) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address || stop.name, stop.country].filter(Boolean).join(', '))}`;

/** Six ideas for a stop from its (shared, cached) destination insights. */
function loadIdeas(stop, opts) {
  return stopInsights(stop, opts).then((insights) => (insights?.thingsToDo || []).map((t) => {
    const place = normalizePlace({ ...t, source: t.verified ? 'foursquare' : 'ai' }, t.category);
    return place && { ...place, description: t.reason || t.visitorTip || null, tip: t.visitorTip || null, photo: t.unsplashKeyword || t.name };
  }).filter(Boolean));
}

/** The route's own day trips as instant ideas. */
function dayTripIdeas(stop) {
  return (Array.isArray(stop.dayTrips) ? stop.dayTrips : []).filter(Boolean).map((name) => ({
    id: `daytrip:${String(name).toLowerCase()}`, name: String(name), category: 'Day trip', source: 'route',
    description: `A day trip from ${stop.name}`, photo: name,
  }));
}

export default function StepDays({ stops, startDate, travelStyles = [], currency = '', from = '', value, onChange, onSkip }) {
  const picks = useMemo(() => (Array.isArray(value?.picks) ? value.picks : []), [value]);
  const [ideas, setIdeas] = useState({}); // stop label → { loading, error, places }

  useEffect(() => {
    let live = true;
    stops.forEach((stop, index) => {
      const label = labelOf(stop);
      setIdeas((m) => (m[label]?.places ? m : { ...m, [label]: { loading: true } }));
      loadIdeas(stop, { index, startDate, travelStyles, currency, from })
        .then((places) => { if (live) setIdeas((m) => ({ ...m, [label]: { places } })); })
        .catch(() => { if (live) setIdeas((m) => ({ ...m, [label]: { error: true, places: [] } })); });
    });
    return () => { live = false; };
  }, [stops.map(labelOf).join('|'), startDate, (travelStyles || []).join(','), currency, from]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next) => onChange({ version: 2, picks: next, interests: value?.interests || [] });
  const kept = (p, label) => picks.some((x) => x.destination === label && (keyOf(x) === keyOf(p) || nameKey(x) === nameKey(p)));
  const toggle = (p, label) => {
    if (kept(p, label)) {
      save(picks.filter((x) => !(x.destination === label && (keyOf(x) === keyOf(p) || nameKey(x) === nameKey(p)))));
      return;
    }
    if (picks.length >= MAX_PICKS) return; // the generator takes 40 at most
    save([...picks, {
      id: p.id || null, name: p.name, address: p.address || null,
      lat: typeof p.lat === 'number' ? p.lat : null, lng: typeof p.lng === 'number' ? p.lng : null,
      category: p.category || null, source: p.source || null, destination: label, day: null,
    }]);
  };

  const total = picks.length;

  return (
    <div className="ms">
      <div className="ms-intro">
        <p>Tap <b>Keep</b> — we’ll fit it into the right day.</p>
        <button type="button" className="ms-skip" onClick={onSkip}>
          {total ? 'Done — plan the rest for me' : 'Skip — you choose for me'}
        </button>
      </div>

      {stops.map((stop) => {
        const label = labelOf(stop);
        const state = ideas[label] || { loading: true };
        const fromRoute = dayTripIdeas(stop);
        const seen = new Set(fromRoute.map(nameKey));
        const list = [...fromRoute, ...((state.places || []).filter((p) => !seen.has(nameKey(p))))];
        const mine = picks.filter((x) => x.destination === label && !list.some((p) => nameKey(p) === nameKey(x)));
        const n = picks.filter((x) => x.destination === label).length;
        return (
          <section key={label} className="ms-stop" aria-labelledby={`ms-h-${slug(label)}`}>
            <header className="ms-stop__head">
              <h2 id={`ms-h-${slug(label)}`}>{stop.name}</h2>
              <span>{rangeLabel(stop)}{n ? ` · ${n} kept` : ''}</span>
            </header>

            <ul className="ms-cards">
              {list.map((p) => {
                const on = kept(p, label);
                return (
                  <li key={keyOf(p)} className={`ms-card${on ? ' ms-card--on' : ''}`}>
                    <CreditedPhoto destination={stop.name} keyword={p.photo || p.name} size="thumb" alt="" style={{ height: 110 }} />
                    <div className="ms-card__body">
                      <div className="ms-card__name">{p.name}</div>
                      {p.description && <div className="ms-card__why">{p.description}</div>}
                      <div className="ms-card__foot">
                        <span className={`ms-tag${p.source === 'ai' ? ' ms-tag--ai' : ''}`}>
                          {p.source === 'route' ? 'Day trip' : p.source === 'ai' ? 'Idea · check first' : 'Real place'}
                        </span>
                        <a href={mapsUrl(p, stop)} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on a map`}>Map</a>
                      </div>
                    </div>
                    <button type="button" className="ms-keep" aria-pressed={on} onClick={() => toggle(p, label)}
                      aria-label={on ? `Kept ${p.name} — remove` : `Keep ${p.name}`}>
                      {on ? '✓ Kept' : '+ Keep'}
                    </button>
                  </li>
                );
              })}
              {state.loading && [0, 1, 2].map((i) => <li key={`sk${i}`} className="ms-card ms-card--skeleton" aria-hidden="true" />)}
            </ul>
            {state.loading && <p className="ms-note" role="status">Finding places in {stop.name}…</p>}
            {state.error && !list.length && <p className="ms-note">Couldn’t load ideas for {stop.name} — add your own below, or skip.</p>}

            {mine.length > 0 && (
              <ul className="ms-mine" aria-label={`Your own places in ${stop.name}`}>
                {mine.map((p) => (
                  <li key={keyOf(p)}>
                    <span>{p.name}</span>
                    <button type="button" onClick={() => toggle(p, label)} aria-label={`Remove ${p.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}

            <AddOwn stop={stop} onAdd={(p) => { if (!kept(p, label)) toggle(p, label); }} />
          </section>
        );
      })}
    </div>
  );
}

/** "Add your own": search this stop, or keep the name as written. */
function AddOwn({ stop, onAdd }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState(null); // { loading } | { places } | { error }
  const run = async (e) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setState({ loading: true });
    try {
      setState({ places: (await searchPlaces({ name: labelOf(stop), lat: stop.lat, lng: stop.lng }, query)).slice(0, 5) });
    } catch (err) {
      setState({ error: err.message || 'Search failed.' });
    }
  };
  const addAsWritten = () => {
    const name = q.trim().slice(0, 120);
    if (!name) return;
    onAdd({ name, source: 'user', category: 'your pick' });
    setQ(''); setState(null);
  };
  return (
    <div className="ms-own">
      <form role="search" onSubmit={run} className="ms-own__row">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} maxLength={120}
          aria-label={`Add your own place in ${stop.name}`} placeholder={`+ Add your own place in ${stop.name}…`} />
        <button type="submit" disabled={!q.trim()}>Find</button>
      </form>
      {state?.loading && <p className="ms-note" role="status">Searching…</p>}
      {state?.error && <p className="ms-note" role="alert">{state.error}</p>}
      {state?.places && (
        <ul className="ms-found">
          {state.places.map((p) => (
            <li key={keyOf(p)}>
              <span><b>{p.name}</b>{p.address ? ` · ${p.address}` : ''}</span>
              <button type="button" onClick={() => { onAdd(p); setQ(''); setState(null); }}>+ Keep</button>
            </li>
          ))}
          <li>
            <span>Not listed?</span>
            <button type="button" onClick={addAsWritten}>Keep “{q.trim().slice(0, 40)}” as written</button>
          </li>
        </ul>
      )}
    </div>
  );
}

/** Footer status: "3 places kept · we'll plan the rest". */
export function daysStatus(selection) {
  const picks = Array.isArray(selection?.picks) ? selection.picks : [];
  if (!picks.length) return "Optional — skip and we'll plan every day";
  return `${picks.length} place${picks.length > 1 ? 's' : ''} kept · we'll plan the rest`;
}
