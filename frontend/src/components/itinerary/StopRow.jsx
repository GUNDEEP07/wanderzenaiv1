import { useState } from 'react';
import { plainText } from '../../utils/plainText';
import { directionsUrl, formatMoney } from '../../utils/tripPlan';
import { googlePhotoSrc, hoursOn, ratingText } from '../../api/googlePlaces';

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

const g = {
  box: { display: 'flex', gap: 12, alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 },
  photo: { position: 'relative', flex: '0 0 96px', height: 80, borderRadius: 8, overflow: 'hidden', background: '#1a2233' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  credit: { position: 'absolute', left: 3, right: 3, bottom: 2, fontSize: 9, color: '#fff', textShadow: '0 1px 2px #000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  lines: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, lineHeight: 1.4 },
  rating: { fontWeight: 800, color: '#fcd34d' },
  closed: { fontWeight: 700, color: '#fca5a5' },
  link: { color: '#00d4aa', fontWeight: 700, textDecoration: 'none' },
  source: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
};

/** Fresh Google details for this stop (rating, hours that day, photo) — never stored. */
function GoogleInfo({ info, date }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  if (!info) return null;
  const hours = hoursOn(info.hours, date);
  const author = info.photo?.authors?.[0];
  const closed = info.status === 'CLOSED_PERMANENTLY' ? 'Google lists this as permanently closed'
    : info.status === 'CLOSED_TEMPORARILY' ? 'Google lists this as temporarily closed' : null;
  return (
    <div style={g.box}>
      {info.photo?.name && !photoFailed && (
        <span style={g.photo}>
          <img src={googlePhotoSrc(info.photo.name, 320)} alt="" loading="lazy" decoding="async" style={g.img} onError={() => setPhotoFailed(true)} />
          {author?.name && <span style={g.credit}>Photo: {author.uri ? <a href={author.uri} target="_blank" rel="noopener noreferrer" style={{ color: '#fff' }}>{author.name}</a> : author.name}</span>}
        </span>
      )}
      <div style={g.lines}>
        {typeof info.rating === 'number' && (
          <span style={g.rating} aria-label={`Rated ${info.rating.toFixed(1)} out of 5 from ${info.reviews || 0} Google reviews`}>{ratingText(info.rating, info.reviews)}</span>
        )}
        {closed && <span style={g.closed} role="note">{closed}</span>}
        {hours && <span>{date.toLocaleDateString('en-AU', { weekday: 'short' })}: {hours}</span>}
        {info.mapsUri && <a href={info.mapsUri} target="_blank" rel="noopener noreferrer" style={g.link}>Open in Google Maps</a>}
        <span style={g.source}>Google Maps</span>
      </div>
    </div>
  );
}

/**
 * One stop in the day: a tappable row that opens its details — why, insider tip, local
 * name (big, to show a driver), directions, and "Mark as done" (kept on this device).
 */
export default function StopRow({ stop, base, destination, currency, isNext, done, onToggleDone, google = null, date = null }) {
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
              <GoogleInfo info={google} date={date} />
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
              <GoogleInfo info={google} date={date} />
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
