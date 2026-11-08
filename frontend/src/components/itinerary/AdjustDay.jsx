import { useState } from 'react';

/**
 * "Adjust this day" (option A, Nov 2026) — shown under each day to the trip's owner only.
 * The owner writes a short note (or taps a suggestion); only that day is rewritten, in the
 * background, and the new PDF is emailed. A few free changes per trip.
 */

export const NOTE_MAX = 300;
export const SUGGESTIONS = [
  'Less walking',
  'More local food',
  'Slower morning',
  'Add a nature walk',
  'Rainy-day plan',
  'Better for kids',
];

const s = {
  bar: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 },
  open: { padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  panel: { marginTop: 14, background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 14, padding: '16px 18px' },
  label: { fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 10 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: (on) => ({ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? '#00d4aa' : 'rgba(255,255,255,0.15)'}`, background: on ? 'rgba(0,212,170,0.15)' : 'transparent', color: on ? '#00d4aa' : 'rgba(255,255,255,0.65)' }),
  textarea: { width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box' },
  row: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  primary: (disabled) => ({ padding: '10px 18px', background: disabled ? 'rgba(0,212,170,0.35)' : 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 10, color: '#06090f', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer' }),
  ghost: { padding: '10px 12px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' },
  error: { fontSize: 12, color: '#ff8a8a', marginTop: 8 },
  working: { marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  dot: { width: 8, height: 8, borderRadius: '50%', background: '#00d4aa', animation: 'wzPulse 1.2s ease-in-out infinite' },
};

/** "Less walking" toggled into / out of the note. */
export function toggleSuggestion(note, suggestion) {
  const parts = note.split(/\s*[,;]\s*/).map(p => p.trim()).filter(Boolean);
  const has = parts.some(p => p.toLowerCase() === suggestion.toLowerCase());
  const next = has ? parts.filter(p => p.toLowerCase() !== suggestion.toLowerCase()) : [...parts, suggestion];
  return next.join(', ').slice(0, NOTE_MAX);
}

/**
 * @param {object} props
 * @param {number} props.dayNumber
 * @param {{ remaining: number, max: number, pending: { day: number }|null }} props.summary
 * @param {(dayNumber: number, note: string) => Promise<void>} props.onStart throws on failure
 */
export default function AdjustDay({ dayNumber, summary, onStart }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!summary) return null;
  const pending = summary.pending;
  if (pending?.day === dayNumber) {
    return (
      <div style={s.working} role="status" data-testid={`adjusting-${dayNumber}`}>
        <span style={s.dot} />
        Rewriting day {dayNumber} — usually about a minute. You can leave this page; the new PDF comes by email.
      </div>
    );
  }
  if (summary.remaining <= 0) return null;

  if (!open) {
    return (
      <div style={s.bar}>
        <button type="button" style={s.open} onClick={() => setOpen(true)} disabled={!!pending}>
          ✎ Adjust this day
        </button>
        {pending && <span style={s.hint}>Another day is being rewritten…</span>}
      </div>
    );
  }

  const trimmed = note.trim();
  const tooShort = trimmed.length < 3;
  const submit = async () => {
    if (tooShort || sending) return;
    setSending(true);
    setError('');
    try {
      await onStart(dayNumber, trimmed);
      setOpen(false);
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={s.panel}>
      <div style={s.label}>What should change on day {dayNumber}?</div>
      <div style={s.chips}>
        {SUGGESTIONS.map(sug => {
          const on = note.toLowerCase().split(/\s*[,;]\s*/).includes(sug.toLowerCase());
          return (
            <button key={sug} type="button" style={s.chip(on)} aria-pressed={on} onClick={() => setNote(n => toggleSuggestion(n, sug))}>
              {sug}
            </button>
          );
        })}
      </div>
      <textarea
        aria-label={`Change for day ${dayNumber}`}
        style={s.textarea}
        value={note}
        maxLength={NOTE_MAX}
        placeholder="e.g. less walking, and a cooking class instead of the evening market"
        onChange={e => setNote(e.target.value)}
      />
      <div style={s.row}>
        <button type="button" style={s.primary(tooShort || sending || !!pending)} disabled={tooShort || sending || !!pending} onClick={submit}>
          {sending ? 'Starting…' : `Rewrite day ${dayNumber}`}
        </button>
        <button type="button" style={s.ghost} onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
        <span style={s.hint}>
          {summary.remaining} of {summary.max} free changes left · only this day changes · new PDF by email
        </span>
      </div>
      {error && <div style={s.error} role="alert">{error}</div>}
    </div>
  );
}
