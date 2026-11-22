import { useCallback, useEffect, useState } from 'react';
import { fetchPreview } from '../../api/itinerary';
import { tripDatesText } from '../../utils/tripDates';
import { priceLines } from '../../utils/plans';

/**
 * Step 5 — Check your trip (Nov 2026 redesign). A summary of every step with an Edit link,
 * the day-outline preview and one optional note. It asks nothing new; the action (generate,
 * sign up, see plans) is the planner footer's button — see reviewAction().
 * Preview state stays in separate useState vars (CLAUDE.md).
 */

/** The line under the action saying what this itinerary uses. `e` from GET /entitlement. */
export function entitlementLine(e) {
  if (!e || !e.allowed) return null;
  const n = Number(e.remaining) || 0;
  if (e.source === 'free') return 'Uses your free itinerary for this month: Day 1 in full, unlock the other days any time.';
  if (e.source === 'credit') return n <= 1 ? 'Uses your last itinerary credit.' : `Uses 1 of your ${n} itinerary credits.`;
  if (e.source === 'pass') return n <= 1 ? 'Uses the last trip on your Trip Pass.' : `Uses 1 of the ${n} trips on your Trip Pass.`;
  if (e.source === 'monthly') return n <= 1 ? 'Uses your last Wanderer itinerary this month.' : `Uses 1 of the ${n} Wanderer itineraries left this month.`;
  if (e.source === 'test') return 'Test account: every day unlocked, nothing is charged.';
  return null;
}

/** Why Submit won't work, said before it's pressed. */
export function limitMessage(e) {
  if (!e || e.allowed) return null;
  return e.code === 'MONTHLY_LIMIT_REACHED'
    ? "You've used this month's Wanderer itineraries — they reset on your next billing date. One trip gets you this one now."
    : "You've used this month's free itinerary. One trip or a Trip Pass gets you this one now.";
}

/** The footer button for this step: { label, kind: 'submit' | 'signup' | 'plans' }. */
export function reviewAction({ signedIn, entitlement, submitting }) {
  if (!signedIn) return { label: 'Create free account', kind: 'signup' };
  if (limitMessage(entitlement)) return { label: 'See plans', kind: 'plans' };
  return { label: submitting ? 'Creating…' : 'Create my itinerary', kind: 'submit' };
}

const PACE = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'Full days' };

/** Guests see exactly what's free and what it costs before they sign up. Prices come from Stripe. */
function PriceTable({ pricing }) {
  const p = priceLines(pricing);
  if (!p) return null;
  const rows = [
    ['Free now', 'Your route, Day 1 in full, every day\u2019s theme'],
    [p.trip, 'Every day, stays, tips and the PDF (unlock any time)'],
    ...(p.pass ? [[p.pass, `Trip Pass: ${p.passTerm}`]] : []),
  ];
  return (
    <table style={s.priceTable} aria-label="What you get">
      <tbody>
        {rows.map(([price, what]) => (
          <tr key={price}>
            <th scope="row" style={s.priceCell}>{price}</th>
            <td style={s.whatCell}>{what}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const s = {
  priceTable: { width: '100%', borderCollapse: 'collapse', margin: '10px 0 4px', fontSize: 14 },
  priceCell: { textAlign: 'left', verticalAlign: 'top', padding: '6px 12px 6px 0', whiteSpace: 'nowrap', color: '#00d4aa', fontWeight: 800, borderTop: '1px solid rgba(255,255,255,0.08)' },
  whatCell: { padding: '6px 0', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.08)' },
  card: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 16px 14px', marginBottom: 10 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  h2: { margin: 0, fontSize: 15, fontWeight: 800 },
  edit: { minHeight: 44, padding: '0 6px', border: 'none', background: 'none', color: '#00d4aa', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  text: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.86)' },
  muted: { color: 'rgba(255,255,255,0.65)' },
  dayRow: { display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8, fontSize: 14, lineHeight: 1.5, padding: '3px 0' },
  outline: { background: '#0f1726', border: '1px solid rgba(0,212,170,0.35)', borderRadius: 16, padding: '12px 16px 14px', marginBottom: 10 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 12 },
  textarea: { borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: '#0a0f1e', color: '#fff', padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical' },
  gate: { background: 'linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,212,170,0.03))', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 },
  warn: { background: 'rgba(255,190,90,0.06)', border: '1px solid rgba(255,190,90,0.35)', borderRadius: 14, padding: '14px 16px', marginBottom: 10, fontSize: 14, lineHeight: 1.5 },
  link: { border: 'none', background: 'none', color: '#00d4aa', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0, minHeight: 36 },
  foot: { fontSize: 13, color: 'rgba(255,255,255,0.68)', textAlign: 'center', margin: '8px 0 0' },
  error: { color: '#ff8a8a', fontSize: 14, margin: '0 0 10px' },
};

const Section = ({ title, onEdit, editLabel, children }) => (
  <section style={s.card} aria-label={title}>
    <div style={s.head}>
      <h2 style={s.h2}>{title}</h2>
      {onEdit && <button type="button" style={s.edit} onClick={onEdit} aria-label={editLabel || `Edit ${title.toLowerCase()}`}>Edit</button>}
    </div>
    {children}
  </section>
);

/** Days of each route stop: [{ name, fromDay, toDay, transferIn }] */
const stopsOf = (route) => {
  let day = 1;
  return (route?.bases || []).map(b => { const from = day; day += b.days || 0; return { name: b.name, fromDay: from, toDay: day - 1, transferIn: b.transferIn }; });
};

export default function StepReview({ form, set, onEditStep, submitError, accountEmail, signedIn = true, entitlement = null, onSignIn, pricing }) {
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadPreview = useCallback(async (formData) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const json = await fetchPreview(formData);
      setPreview(json.days || json.data?.days || null);
    } catch (e) {
      console.error('Preview failed', e);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => { loadPreview(form); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prefs = form.tripPrefs || {};
  const kids = (prefs.kids || []).length;
  const people = `${prefs.adults || 2} adult${(prefs.adults || 2) > 1 ? 's' : ''}${kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`;
  const when = form.travelDate && form.travelDateEnd && !form.datesFlexible ? tripDatesText(form.travelDate, form.travelDateEnd) : `${form.days} days · dates not fixed`;
  const budget = Number(form.budget) ? `${form.currency} ${Number(form.budget).toLocaleString('en-US')} ${form.budgetScope === 'activities-only' ? 'for activities' : 'whole trip'}` : null;
  const stops = stopsOf(form.route);
  const picks = Array.isArray(form.selected_venues?.picks) ? form.selected_venues.picks : [];
  const dayLabel = (st) => (st.toDay > st.fromDay ? `Days ${st.fromDay}–${st.toDay}` : `Day ${st.fromDay}`);

  return (
    <div>
      <Section title="Trip" onEdit={() => onEditStep(0)} editLabel="Edit trip basics">
        <p style={s.text}>
          {form.destinations?.[0]?.name || '—'} · {when}<br />
          {people} · {PACE[form.travelPace] || 'Balanced'} pace{budget ? ` · ${budget}` : ''}
          {form.interests ? <><br /><span style={s.muted}>Enjoys: {form.interests}</span></> : null}
        </p>
      </Section>

      {stops.length > 0 && (
        <Section title="Route" onEdit={() => onEditStep(1)}>
          <p style={s.text}>
            {stops.map((st, i) => (
              <span key={`${st.name}-${i}`}>{i > 0 ? ' → ' : ''}{st.name} <span style={s.muted}>({dayLabel(st).toLowerCase()})</span></span>
            ))}
          </p>
        </Section>
      )}

      <Section title="Your days" onEdit={() => onEditStep(2)} editLabel="Edit your days">
        {picks.length === 0 ? (
          <p style={{ ...s.text, ...s.muted }}>No places picked — we'll choose every day from your interests.</p>
        ) : (
          <div>
            {Array.from({ length: Number(form.days) || 0 }, (_, i) => i + 1).map(d => {
              const list = picks.filter(p => p.day === d).map(p => p.name);
              return list.length ? <div key={d} style={s.dayRow}><b>Day {d}</b><span>{list.join(', ')}</span></div> : null;
            })}
            {picks.some(p => !p.day) && <div style={s.dayRow}><b>Any day</b><span>{picks.filter(p => !p.day).map(p => p.name).join(', ')}</span></div>}
            <div style={{ ...s.dayRow, ...s.muted }}><b>Other days</b><span>We'll choose, based on your interests</span></div>
          </div>
        )}
      </Section>

      <Section title="Stays" onEdit={() => onEditStep(3)} editLabel="Edit stays and flights">
        <p style={s.text}>
          {form.alreadyBooked
            ? 'Already booked — we plan around them.'
            : (form.route?.bases || []).filter(b => b.stayType).map(b => `${b.stayType} (${b.name})`).join(' · ') || 'Suggested in your itinerary.'}
        </p>
      </Section>

      <section style={s.outline} aria-label="Day outline preview" aria-busy={previewLoading}>
        <h2 style={{ ...s.h2, marginBottom: 8 }}>Day outline (preview)</h2>
        {previewLoading && <div style={s.muted} role="status">Sketching your days…</div>}
        {!previewLoading && preview && (
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.map((d, i) => (
              <li key={i} style={{ fontSize: 14, lineHeight: 1.45 }}><b>{d.theme}</b>{d.vibe ? <span style={s.muted}> — {d.vibe}</span> : null}</li>
            ))}
          </ol>
        )}
        {!previewLoading && !preview && <div style={s.muted}>The outline isn't available right now — your itinerary will still be complete.</div>}
        <label style={s.label}>Anything else we should know? (optional)
          <textarea rows={2} maxLength={300} style={s.textarea} value={form.userMustDos || ''} onChange={e => set('userMustDos', e.target.value)}
            onBlur={() => loadPreview(form)} placeholder="e.g. dinner already booked on day 2; we land late on day 1" />
        </label>
      </section>

      {submitError && <p role="alert" style={s.error}>{submitError}</p>}

      {!signedIn && (
        <div style={s.gate} data-testid="signin-gate">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Create a free account to get this itinerary</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            It's free to start: your route, Day 1 written in full and a theme for every other day. Unlock all the days from the trip page whenever you like. Everything you've planned is kept — you'll come straight back here.
          </div>
          <PriceTable pricing={pricing} />
          <button type="button" style={{ ...s.link, marginTop: 6 }} onClick={onSignIn}>I already have an account</button>
        </div>
      )}
      {signedIn && limitMessage(entitlement) && <div style={s.warn} role="status">{limitMessage(entitlement)}</div>}

      <p style={s.foot}>
        {signedIn && entitlementLine(entitlement) ? `${entitlementLine(entitlement)} · ` : ''}
        Takes about 5 minutes · PDF delivered by email{signedIn && accountEmail ? ` to ${accountEmail}` : ''}
      </p>
    </div>
  );
}
