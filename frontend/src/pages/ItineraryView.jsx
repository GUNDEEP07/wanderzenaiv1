import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';
import { fetchAdjustments, startDayAdjustment, fetchPdfLink, unlockTrip } from '../api/itinerary';
import { plainText } from '../utils/plainText';
import { buildIcs } from '../utils/ics';
import { dayDate, dayStops, directionsUrl, formatMoney, shortDate, todayDayNumber, upNext } from '../utils/tripPlan';
import { loadDone, loadSavedTrip, saveDone, saveTrip } from '../utils/tripCache';
import { nextQuery } from '../utils/safeNext';
import { openUrl } from '../utils/openUrl';
import AdjustDay from '../components/itinerary/AdjustDay';
import LockedDay, { lockedRange, unlockExtras } from '../components/itinerary/LockedDay';
import StopRow from '../components/itinerary/StopRow';
import TripOverview from '../components/itinerary/TripOverview';

/** How often the page checks on a day being rewritten. */
export const ADJUST_POLL_MS = 5000;

const API_URL = import.meta.env.VITE_API_URL;

/*
 * The trip page, built for using on the road (approved mock-up, Nov 2026): it opens on
 * today's day when the trip is under way, one day at a time with big tap targets,
 * directions per stop, the local name to show a driver, "mark as done", calendar export
 * and a saved copy for when there's no signal. The owner downloads the PDF from here with
 * a fresh link each time (the email links to this page).
 */

const s = {
  page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '10px clamp(14px, 4vw, 28px)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,9,15,0.96)', backdropFilter: 'blur(16px)' },
  navBtn: { minHeight: 44, padding: '0 10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 },
  wrap: { maxWidth: 760, margin: '0 auto', padding: '0 clamp(14px, 4vw, 24px) 80px' },
  kicker: { fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00d4aa' },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '8px 0 12px' },
  summary: { fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, margin: '0 0 16px' },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: { padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  action: { minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  actionPrimary: { background: '#00d4aa', color: '#06090f', border: '1px solid #00d4aa' },
  notice: (tone) => ({ margin: '12px 0', padding: '12px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.5,
    background: tone === 'error' ? 'rgba(255,107,107,0.08)' : tone === 'info' ? 'rgba(255,255,255,0.05)' : 'rgba(0,212,170,0.1)',
    border: `1px solid ${tone === 'error' ? 'rgba(255,107,107,0.3)' : tone === 'info' ? 'rgba(255,255,255,0.12)' : 'rgba(0,212,170,0.3)'}`,
    color: tone === 'error' ? '#ff9b9b' : tone === 'info' ? 'rgba(255,255,255,0.85)' : '#5eead4' }),
  dayBar: { position: 'sticky', top: 64, zIndex: 5, background: '#06090f', padding: '10px 0', margin: '12px 0 4px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' },
  dayChip: (on, today) => ({ flex: 'none', minWidth: 56, minHeight: 44, padding: '0 14px', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
    fontWeight: on ? 800 : 600, border: on ? '1px solid #00d4aa' : `1px solid ${today ? 'rgba(0,212,170,0.5)' : 'rgba(255,255,255,0.14)'}`,
    background: on ? '#00d4aa' : 'transparent', color: on ? '#06090f' : 'rgba(255,255,255,0.8)' }),
  dayHead: { margin: '8px 0 12px' },
  dayH2: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 700, lineHeight: 1.2, margin: '4px 0 0' },
  next: { background: '#0f1726', border: '1px solid rgba(0,212,170,0.4)', borderRadius: 18, padding: 16, margin: '8px 0 16px' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  pager: { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 },
};

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON = {
  back: 'M15 18l-6-6 6-6',
  forward: 'M9 18l6-6-6-6',
  download: 'M12 3v12m0 0l-5-5m5 5l5-5M5 21h14',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  share: 'M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14',
  nav: 'M3 11l18-8-8 18-2-8-8-2z',
  lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14v10H5z',
};

export default function ItineraryView() {
  const { id } = useParams();
  const location = useLocation();
  const { getIdToken, currentUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offlineSince, setOfflineSince] = useState(null); // savedAt of the copy shown offline
  const [savedOffline, setSavedOffline] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [done, setDone] = useState(() => new Set());
  const [notice, setNotice] = useState(null); // { tone, text, action? }
  const [pdfBusy, setPdfBusy] = useState(false);
  // "Adjust this day": null unless the viewer owns this trip (the API decides).
  const [adjust, setAdjust] = useState(null);
  const [adjustNotice, setAdjustNotice] = useState(null);
  const watchedId = useRef(null);
  const autoDownloadTried = useRef(false);
  // Free trips: Day 1 only until the owner unlocks (trip-access.js on the API).
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState(null);

  const wantsDownload = new URLSearchParams(location.search || '').get('download') === '1';
  const wantsUnlock = new URLSearchParams(location.search || '').get('unlock') === '1';

  const loadItinerary = useCallback(async () => {
    const headers = {};
    try {
      const token = await getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch { /* not signed in — public view */ }
    const res = await fetch(`${API_URL}/itinerary?id=${encodeURIComponent(id)}`, { headers, cache: 'no-store' });
    if (!res.ok) throw Object.assign(new Error('Could not load itinerary'), { status: res.status });
    return res.json();
  }, [id, getIdToken]);

  useEffect(() => {
    if (!id) return;
    setDone(loadDone(id));
    (async () => {
      try {
        const d = await loadItinerary();
        setData(d);
        setOfflineSince(null);
        setSavedOffline(saveTrip(id, d));
        analytics.itineraryViewed(d.destination);
      } catch (e) {
        const saved = !e.status || e.status >= 500 ? loadSavedTrip(id) : null;
        if (saved) { setData(saved.data); setOfflineSince(saved.savedAt); } else setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const itin = data?.itinerary;
  const days = itin?.days || [];
  const todayNumber = todayDayNumber(data?.travelDate, days.length);

  // Open on today's day when the trip is under way, else day 1 — or, from an "Unlock" link,
  // on the first locked day, where the unlock card is.
  useEffect(() => {
    if (!days.length || selectedDay != null) return;
    const firstLocked = days.find(d => d.locked);
    if (wantsUnlock && firstLocked) { setSelectedDay(firstLocked.dayNumber); return; }
    setSelectedDay(todayNumber && days.some(d => d.dayNumber === todayNumber) ? todayNumber : days[0].dayNumber);
  }, [days.length, todayNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Owner? Then load what's left; keep checking while a day is being rewritten.
  useEffect(() => {
    if (!id || !currentUser) { setAdjust(null); return undefined; }
    let live = true;
    fetchAdjustments(id).then(a => {
      if (!live) return;
      setAdjust(a);
      if (a?.pending) watchedId.current = a.pending.id;
    });
    return () => { live = false; };
  }, [id, currentUser]);

  useEffect(() => {
    if (!adjust?.pending) return undefined;
    const timer = setInterval(async () => {
      const a = await fetchAdjustments(id);
      if (!a) return;
      setAdjust(a);
      const finished = a.items.find(x => x.id === watchedId.current);
      if (a.pending || !finished) return;
      watchedId.current = null;
      if (finished.status === 'done') {
        try { const d = await loadItinerary(); setData(d); saveTrip(id, d); } catch { /* keep showing the old day */ }
        setSelectedDay(finished.day);
        setAdjustNotice({ tone: 'ok', text: `Day ${finished.day} is updated. The new PDF is on its way to your email.` });
      } else {
        setAdjustNotice({ tone: 'error', text: `We couldn't rewrite day ${finished.day} this time — it didn't use up a change, so please try again.` });
      }
    }, ADJUST_POLL_MS);
    return () => clearInterval(timer);
  }, [adjust?.pending, id, loadItinerary]);

  const startAdjust = async (dayNumber, note) => {
    const a = await startDayAdjustment(id, dayNumber, note); // throws with a message
    watchedId.current = a.pending?.id || null;
    setAdjust(a);
    setAdjustNotice(null);
  };

  const signInPath = `/login?${nextQuery(`/itinerary/${id}?download=1`)}`;
  const unlockSignInPath = `/login?${nextQuery(`/itinerary/${id}?unlock=1`)}`;

  const unlock = async () => {
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      await unlockTrip(id);
      const fresh = await loadItinerary();
      setData(fresh);
      setSavedOffline(saveTrip(id, fresh));
      setNotice({ tone: 'ok', text: 'Your full trip is unlocked — every day is open, and a PDF with all of it is on its way to your email.' });
    } catch (e) {
      if (e.code === 'NEEDS_ITINERARY') {
        navigate('/pricing', { state: { reason: 'unlock', destination: data?.destination, tripId: id } });
        return;
      }
      if (e.code === 'SIGN_IN') { navigate(unlockSignInPath); return; }
      setUnlockError(e.message);
    } finally {
      setUnlockBusy(false);
    }
  };

  const downloadPdf = useCallback(async () => {
    setPdfBusy(true);
    setNotice(null);
    try {
      const { url } = await fetchPdfLink(id);
      openUrl(url);
    } catch (e) {
      setNotice(e.code === 'SIGN_IN'
        ? { tone: 'info', text: e.message, action: { label: 'Sign in', to: signInPath } }
        : { tone: 'error', text: e.message });
    } finally {
      setPdfBusy(false);
    }
  }, [id, signInPath]);

  // From the email ("?download=1"): start the download once the owner is known.
  useEffect(() => {
    if (!wantsDownload || !data || autoDownloadTried.current) return;
    if (data.isOwner && data.hasPdf) { autoDownloadTried.current = true; downloadPdf(); }
    else if (!currentUser) { autoDownloadTried.current = true; setNotice({ tone: 'info', text: 'Sign in with the email this trip was sent to, to download the PDF.', action: { label: 'Sign in', to: signInPath } }); }
  }, [wantsDownload, data, currentUser, downloadPdf, signInPath]);

  const addToCalendar = () => {
    const ics = buildIcs({ submissionId: id, destination: data.destination, travelDate: data.travelDate, itinerary: itin });
    if (!ics) return;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `WanderZen-${String(data.destination || 'trip').replace(/[^A-Za-z0-9]+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
    setNotice({ tone: 'ok', text: 'Calendar file downloaded — open it to add every stop (with a reminder 30 minutes before).' });
  };

  const shareUrl = `https://www.wanderzenai.com/itinerary/${id}`;
  const share = async () => {
    const text = `My slow travel plan for ${data?.destination || 'this trip'}`;
    try {
      if (navigator.share) { await navigator.share({ title: itin?.title || text, text, url: shareUrl }); return; }
      await navigator.clipboard.writeText(shareUrl);
      setNotice({ tone: 'ok', text: 'Link copied — anyone with it can see the plan (not your travel dates).' });
    } catch { /* cancelled */ }
  };

  const toggleDone = (dayNumber, stopId) => {
    setDone(prev => {
      const next = new Set(prev);
      const key = `${dayNumber}:${stopId}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      saveDone(id, next);
      return next;
    });
  };

  const day = useMemo(() => days.find(d => d.dayNumber === selectedDay) || null, [days, selectedDay]);
  const stops = useMemo(() => dayStops(day), [day]);
  const isToday = !!day && day.dayNumber === todayNumber;
  const doneToday = useMemo(() => new Set([...done].filter(k => k.startsWith(`${day?.dayNumber}:`)).map(k => k.split(':')[1])), [done, day]);
  const nextStop = isToday ? upNext(stops, new Date(), doneToday) : null;

  if (loading) {
    return <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading itinerary…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ ...s.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Itinerary not found</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 24 }}>This itinerary may still be generating or doesn't exist.</div>
        <button onClick={() => navigate(currentUser ? '/dashboard' : '/')} style={{ ...s.action, ...s.actionPrimary }}>{currentUser ? 'Back to Dashboard' : 'Go to home'}</button>
      </div>
    );
  }

  const currency = data.currency || itin?.currency || 'USD';
  const dateOf = (n) => dayDate(data.travelDate, n);
  const idx = days.findIndex(d => d.dayNumber === selectedDay);

  return (
    <div style={s.page}>
      <style>{'* { box-sizing: border-box; } .wz-daybar::-webkit-scrollbar { display: none; } @media (max-width: 420px) { .wz-hide-narrow { display: none; } }'}</style>

      <nav style={s.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a href="/" aria-label="WanderZenAI home" style={{ ...s.navBtn, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
            <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0a0f1e' }}>W</span>
            <span className="wz-hide-narrow">WanderZenAI</span>
          </a>
          {currentUser && (
            <button onClick={() => navigate('/dashboard')} style={{ ...s.navBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon d={ICON.back} /> Dashboard
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={share} style={{ ...s.navBtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon d={ICON.share} /> Share</button>
          <button onClick={() => navigate('/feedback')} style={s.navBtn}>Feedback</button>
        </div>
      </nav>

      <main style={s.wrap}>
        <header style={{ paddingTop: 24 }}>
          <div style={s.kicker}>{data.days} days · {data.destination}{data.travelerType ? ` · ${data.travelerType}` : ''}</div>
          <h1 style={s.h1}>{itin?.title || `${data.destination} — ${data.days} day itinerary`}</h1>
          {itin?.summary && <p style={s.summary}>{plainText(itin.summary)}</p>}
          <div style={s.chips}>
            {data.travelDate && <span style={s.chip}>{shortDate(dateOf(1))} – {shortDate(dateOf(days.length || data.days))}</span>}
            {formatMoney(itin?.totalEstimatedCost, currency) && <span style={s.chip}>Est. {formatMoney(itin.totalEstimatedCost, currency)}</span>}
            {offlineSince
              ? <span style={{ ...s.chip, color: '#ffe27a', borderColor: 'rgba(255,217,61,0.35)' }}>Offline · saved copy</span>
              : savedOffline && <span style={{ ...s.chip, color: '#5eead4', borderColor: 'rgba(0,212,170,0.35)' }}>Saved on this device for offline</span>}
          </div>

          <div style={s.actions}>
            {data.isOwner && data.hasPdf && (
              <button style={{ ...s.action, ...s.actionPrimary }} onClick={downloadPdf} disabled={pdfBusy} aria-busy={pdfBusy}>
                <Icon d={ICON.download} /> {pdfBusy ? 'Preparing…' : 'Download PDF'}
              </button>
            )}
            {wantsDownload && !data.isOwner && !currentUser && (
              <a href={signInPath} onClick={(e) => { e.preventDefault(); navigate(signInPath); }} style={s.action}><Icon d={ICON.download} /> Sign in to download the PDF</a>
            )}
            {data.isOwner && data.travelDate && (
              <button style={s.action} onClick={addToCalendar}><Icon d={ICON.calendar} /> Add to calendar</button>
            )}
          </div>
          {data.isOwner && !data.travelDate && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0' }}>Add your travel dates when you plan a trip to get a calendar file and a “today” view.</p>
          )}
          {offlineSince && (
            <div role="status" style={s.notice('info')}>No connection — showing the copy saved on {new Date(offlineSince).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</div>
          )}
          {notice && (
            <div role="status" style={s.notice(notice.tone)}>
              {notice.text}
              {notice.action && <> <a href={notice.action.to} onClick={(e) => { e.preventDefault(); navigate(notice.action.to); }} style={{ color: '#00d4aa', fontWeight: 700 }}>{notice.action.label}</a></>}
            </div>
          )}
          {adjustNotice && <div role="status" style={s.notice(adjustNotice.tone)}>{adjustNotice.text}</div>}
          {!data.locked && adjust && adjust.remaining > 0 && !adjust.pending && !adjustNotice && (
            <div style={{ margin: '8px 0', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              Not quite right? Adjust any day — {adjust.remaining} free change{adjust.remaining === 1 ? '' : 's'} left on this trip.
            </div>
          )}
        </header>

        {days.length > 0 && (
          <>
            <div className="wz-daybar" role="tablist" aria-label="Days" style={s.dayBar}>
              {days.map(d => {
                const isTodayChip = d.dayNumber === todayNumber;
                return (
                  <button key={d.dayNumber} role="tab" aria-selected={d.dayNumber === selectedDay} aria-controls="wz-day-panel"
                    aria-label={d.locked ? `Day ${d.dayNumber}, locked` : undefined}
                    style={{ ...s.dayChip(d.dayNumber === selectedDay, isTodayChip), ...(d.locked ? { display: 'inline-flex', alignItems: 'center', gap: 5 } : {}) }} onClick={() => setSelectedDay(d.dayNumber)}>
                    {isTodayChip ? `Today · ${d.dayNumber}` : `Day ${d.dayNumber}`}
                    {d.locked && <Icon d={ICON.lock} size={13} />}
                  </button>
                );
              })}
            </div>

            {day && (
              <section id="wz-day-panel" role="tabpanel" aria-label={`Day ${day.dayNumber}`}>
                <div style={s.dayHead}>
                  <div style={s.kicker}>
                    {[day.base, data.travelDate ? shortDate(dateOf(day.dayNumber)) : `Day ${day.dayNumber}`].filter(Boolean).join(' · ')}
                    {day.travelDay ? ' · travel day' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={s.dayH2}>{day.theme || `Day ${day.dayNumber}`}</h2>
                    {day.adjusted && (
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4b5fd', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, padding: '3px 8px' }}>Updated</span>
                    )}
                  </div>
                  {formatMoney(day.dailyCost, currency) && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Day budget ≈ {formatMoney(day.dailyCost, currency)}</div>}
                </div>

                {day.locked ? (
                  <LockedDay
                    range={lockedRange(days)}
                    extras={unlockExtras(itin?.locked)}
                    error={unlockError}
                    action={data.isOwner
                      ? { kind: 'unlock', onClick: unlock, busy: unlockBusy }
                      : !currentUser
                        ? { kind: 'signin', to: unlockSignInPath, onNavigate: () => navigate(unlockSignInPath) }
                        : { kind: 'owner-only' }}
                  />
                ) : (<>
                {nextStop && (
                  <section aria-label="Up next" style={s.next}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={s.kicker}>Up next · {nextStop.timeLabel}</span>
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, margin: '8px 0 6px' }}>{nextStop.title}</div>
                    {nextStop.act.insiderTip && <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>{plainText(nextStop.act.insiderTip)}</p>}
                    <a href={directionsUrl(nextStop.place, day.base, data.destination)}
                      target="_blank" rel="noreferrer" style={{ ...s.action, ...s.actionPrimary, width: '100%', justifyContent: 'center' }}>
                      <Icon d={ICON.nav} /> Directions
                    </a>
                  </section>
                )}

                <ol aria-label={`Day ${day.dayNumber} plan`} style={s.list}>
                  {stops.map(st => (
                    <StopRow key={`${day.dayNumber}-${st.id}`} stop={st} base={day.base} destination={data.destination} currency={currency}
                      isNext={nextStop?.id === st.id} done={doneToday.has(st.id)} onToggleDone={() => toggleDone(day.dayNumber, st.id)} />
                  ))}
                </ol>

                {!data.locked && <AdjustDay dayNumber={day.dayNumber} summary={adjust} onStart={startAdjust} />}
                </>)}

                <div style={s.pager}>
                  <button style={{ ...s.action, visibility: idx > 0 ? 'visible' : 'hidden' }} onClick={() => setSelectedDay(days[idx - 1]?.dayNumber)}><Icon d={ICON.back} /> Day {days[idx - 1]?.dayNumber}</button>
                  <button style={{ ...s.action, visibility: idx >= 0 && idx < days.length - 1 ? 'visible' : 'hidden' }} onClick={() => setSelectedDay(days[idx + 1]?.dayNumber)}>Day {days[idx + 1]?.dayNumber} <Icon d={ICON.forward} /></button>
                </div>
              </section>
            )}
          </>
        )}

        <div style={{ marginTop: 32 }}>
          <TripOverview itinerary={itin} currency={currency} onPickDay={(n) => { setSelectedDay(n); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }}
            onUnlock={() => { const first = days.find(d => d.locked); if (first) setSelectedDay(first.dayNumber); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }} />
        </div>

        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Made with WanderZenAI · slow travel, no tourist traps</div>
          <button onClick={() => navigate('/plan')} style={{ ...s.action, ...s.actionPrimary }}>Plan another trip →</button>
        </footer>
      </main>
    </div>
  );
}
