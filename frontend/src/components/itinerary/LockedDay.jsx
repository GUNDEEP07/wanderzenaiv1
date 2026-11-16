/**
 * Free trips show Day 1; later days arrive from the API as teasers only ({ dayNumber, theme,
 * base, locked }), so there is no real text to hide. These draw a blurred stand-in day (generic
 * shapes, nothing from the trip) under the unlock card.
 */

const s = {
  wrap: { position: 'relative', marginTop: 8 },
  ghost: { filter: 'blur(6px)', opacity: 0.55, pointerEvents: 'none', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 12px' },
  row: { display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'start', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 14px' },
  bar: (w, h = 10, a = 0.16) => ({ height: h, width: w, borderRadius: 6, background: `rgba(255,255,255,${a})`, marginBottom: 8 }),
  card: { position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', margin: '0 auto', maxWidth: 440, background: 'rgba(10,15,30,0.92)', border: '1px solid rgba(0,212,170,0.35)', borderRadius: 18, padding: '22px 20px', boxShadow: '0 18px 48px rgba(0,0,0,0.45)', textAlign: 'center' },
  kicker: { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 6 },
  title: { fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 800, lineHeight: 1.25, margin: '0 0 8px' },
  text: { fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '0 0 14px' },
  btn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 22px', borderRadius: 12, border: 'none', background: '#00d4aa', color: '#06090f', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
  small: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 1.5 },
  err: { fontSize: 13, color: '#ffb4b4', marginTop: 10 },
};

/** What unlocking adds, from the API's `itinerary.locked` counts. */
export function unlockExtras(locked = {}) {
  return [
    locked.stays ? 'where to stay' : null,
    locked.tips ? `${locked.tips} slow travel tip${locked.tips === 1 ? '' : 's'}` : null,
    locked.avoid ? `${locked.avoid} tourist trap${locked.avoid === 1 ? '' : 's'} to skip` : null,
  ].filter(Boolean);
}

/** "Days 2–7" for the locked range of a trip. */
export function lockedRange(days = []) {
  const shut = days.filter(d => d.locked).map(d => d.dayNumber);
  if (!shut.length) return '';
  const lo = Math.min(...shut), hi = Math.max(...shut);
  return lo === hi ? `Day ${lo}` : `Days ${lo}–${hi}`;
}

/**
 * The unlock call to action. `action` decides the button:
 *   { kind: 'unlock', onClick, busy }   owner, signed in
 *   { kind: 'signin', to, onNavigate }  signed out
 *   { kind: 'owner-only' }              someone else's shared trip
 */
export function UnlockCard({ range, extras = [], action, error, style }) {
  return (
    <div style={{ ...s.card, ...style }} role="region" aria-label="Unlock the full trip">
      <div style={s.kicker}>Free preview · Day 1</div>
      <h3 style={s.title}>{range} {range.startsWith('Days') ? 'are' : 'is'} written and waiting</h3>
      <p style={s.text}>
        Unlock the full trip to open every day{extras.length ? `, with ${extras.join(', ')}` : ''} — and a PDF with all of it.
      </p>
      {action.kind === 'unlock' && (
        <button type="button" style={{ ...s.btn, opacity: action.busy ? 0.7 : 1 }} onClick={action.onClick} disabled={action.busy} aria-busy={action.busy}>
          {action.busy ? 'Unlocking…' : 'Unlock the full trip'}
        </button>
      )}
      {action.kind === 'signin' && (
        <a href={action.to} onClick={(e) => { e.preventDefault(); action.onNavigate(); }} style={{ ...s.btn, textDecoration: 'none' }}>Sign in to unlock</a>
      )}
      {action.kind === 'owner-only' && <p style={{ ...s.small, marginTop: 0 }}>Only the person who planned this trip can unlock it.</p>}
      {action.kind === 'unlock' && <div style={s.small}>Uses one itinerary from your plan. No itinerary left? We'll show you the options.</div>}
      {error && <div role="alert" style={s.err}>{error}</div>}
    </div>
  );
}

/** A locked day: its header comes from the page; this is the blurred body + unlock card. */
export default function LockedDay({ range, extras, action, error }) {
  return (
    <div style={s.wrap}>
      <div style={s.ghost} aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={s.row}>
            <div><div style={s.bar(40, 12, 0.22)} /><div style={s.bar(28, 8)} /></div>
            <div>
              <div style={s.bar(`${70 - i * 8}%`, 14, 0.24)} />
              <div style={s.bar('92%')} />
              <div style={s.bar(`${60 + i * 6}%`)} />
            </div>
          </div>
        ))}
      </div>
      <UnlockCard range={range} extras={extras} action={action} error={error} />
    </div>
  );
}
