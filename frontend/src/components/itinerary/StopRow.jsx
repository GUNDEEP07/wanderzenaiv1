import { useState } from 'react';
import { plainText } from '../../utils/plainText';
import { directionsUrl, formatMoney } from '../../utils/tripPlan';

const s = {
  row: { borderTop: '1px solid rgba(255,255,255,0.08)' },
  head: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '10px 4px', background: 'none', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  time: { width: 64, flexShrink: 0, fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', lineHeight: 1.25 },
  period: { display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  title: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4 },
  badge: { flexShrink: 0, fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '2px 8px' },
  chevron: { flexShrink: 0, color: 'rgba(255,255,255,0.5)', transition: 'transform 0.15s' },
  body: { padding: '0 4px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 },
  place: { fontSize: 13, fontWeight: 600, color: '#00d4aa' },
  why: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)' },
  tip: { background: 'rgba(255,217,61,0.08)', borderRadius: 10, padding: '10px 12px', fontSize: 14, lineHeight: 1.5, color: '#ffe27a' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  primary: { minHeight: 44, padding: '0 16px', borderRadius: 12, background: '#00d4aa', color: '#06090f', fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 },
  secondary: { minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  driverCard: { background: '#fff', color: '#06090f', borderRadius: 12, padding: '16px 18px', fontSize: 26, fontWeight: 800, lineHeight: 1.3 },
};

const KIND_COLOR = { eat: '#ff9b9b', gem: '#a78bfa' };

/**
 * One stop in the day: a tappable row that opens its details — why, insider tip, local
 * name (big, to show a driver), directions, and "Mark as done" (kept on this device).
 */
export default function StopRow({ stop, base, destination, currency, isNext, done, onToggleDone }) {
  const [open, setOpen] = useState(isNext);
  const [showLocal, setShowLocal] = useState(false);
  const act = stop.act;
  const cost = stop.kind === 'activity' ? (act.isFree ? 'Free' : formatMoney(act.cost, currency)) : stop.kind === 'eat' ? formatMoney(stop.eats?.cost, currency) : '';
  const bodyId = `stop-${stop.id}`;

  return (
    <li style={{ ...s.row, opacity: done && !open ? 0.6 : 1 }}>
      <button type="button" style={s.head} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span style={{ ...s.time, color: KIND_COLOR[stop.kind] || (isNext ? '#00d4aa' : s.time.color) }}>
          {stop.kind === 'activity' ? stop.timeLabel : stop.period}
          {stop.kind === 'activity' && <span style={s.period}>{stop.period}</span>}
        </span>
        <span style={{ ...s.title, fontWeight: isNext ? 700 : 500, fontStyle: stop.kind === 'gem' ? 'italic' : 'normal', textDecoration: done ? 'line-through' : 'none' }}>
          {stop.kind === 'gem' ? plainText(stop.title) : stop.title}
        </span>
        {isNext && !done && <span style={{ ...s.badge, background: '#00d4aa', color: '#06090f' }}>Next</span>}
        {done && <span style={{ ...s.badge, color: '#00d4aa', border: '1px solid rgba(0,212,170,0.4)' }}>Done</span>}
        {!isNext && !done && cost && <span style={{ ...s.badge, color: 'rgba(255,255,255,0.75)' }}>{cost}</span>}
        <svg style={{ ...s.chevron, transform: open ? 'rotate(180deg)' : 'none' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div id={bodyId} style={s.body}>
          {stop.kind === 'activity' && (
            <>
              {act.location && <div style={s.place}>{act.location}{act.localName ? ` · ${act.localName}` : ''}</div>}
              {act.why && <p style={s.why}>{plainText(act.why)}</p>}
              {act.insiderTip && <div style={s.tip}><strong>Insider tip:</strong> {plainText(act.insiderTip)}</div>}
              {showLocal && act.localName && <div style={s.driverCard} lang="und">{act.localName}</div>}
              <div style={s.actions}>
                <a href={directionsUrl(stop.place, base, destination)} target="_blank" rel="noreferrer" style={s.primary}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
                  Directions
                </a>
                <button type="button" style={s.secondary} onClick={onToggleDone}>{done ? 'Not done yet' : 'Mark as done'}</button>
                {act.localName && (
                  <button type="button" style={s.secondary} aria-pressed={showLocal} onClick={() => setShowLocal(v => !v)}>
                    {showLocal ? 'Hide local name' : 'Show to a driver'}
                  </button>
                )}
              </div>
            </>
          )}
          {stop.kind === 'eat' && (
            <>
              {stop.eats?.dish && <p style={s.why}>Order: <strong>{stop.eats.dish}</strong></p>}
              {stop.eats?.vibe && <p style={{ ...s.why, color: 'rgba(255,255,255,0.7)' }}>{stop.eats.vibe}</p>}
              <div style={s.actions}>
                <a href={directionsUrl(stop.place, base, destination)} target="_blank" rel="noreferrer" style={s.primary}>Directions</a>
              </div>
            </>
          )}
          {stop.kind === 'gem' && (
            <div style={s.actions}>
              <a href={directionsUrl(plainText(stop.title).split(/[.,—–]/)[0], base, destination)} target="_blank" rel="noreferrer" style={s.secondary}>Find it on the map</a>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
