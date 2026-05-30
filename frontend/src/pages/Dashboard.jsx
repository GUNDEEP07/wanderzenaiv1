import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function timeAgo(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? 's' : ''} ago`;
}

function extractCountry(destination) {
  if (!destination) return null;
  const parts = destination.split(',');
  return parts[parts.length - 1].trim();
}

function getFlag(dest) {
  if (!dest) return '✦';
  const d = dest.toLowerCase();
  const map = {
    japan:'🇯🇵', mexico:'🇲🇽', india:'🇮🇳', france:'🇫🇷', germany:'🇩🇪',
    thailand:'🇹🇭', indonesia:'🇮🇩', australia:'🇦🇺', italy:'🇮🇹', spain:'🇪🇸',
    usa:'🇺🇸', 'united states':'🇺🇸', uk:'🇬🇧', 'united kingdom':'🇬🇧',
    portugal:'🇵🇹', morocco:'🇲🇦', vietnam:'🇻🇳', peru:'🇵🇪',
    nepal:'🇳🇵', greece:'🇬🇷', bali:'🇮🇩', goa:'🇮🇳', kyoto:'🇯🇵',
    shimla:'🇮🇳', manali:'🇮🇳', bir:'🇮🇳', 'new delhi':'🇮🇳', delhi:'🇮🇳',
    oaxaca:'🇲🇽', bangkok:'🇹🇭', singapore:'🇸🇬', dubai:'🇦🇪',
    'hong kong':'🇭🇰', barcelona:'🇪🇸', amsterdam:'🇳🇱', rome:'🇮🇹',
  };
  for (const [k, v] of Object.entries(map)) { if (d.includes(k)) return v; }
  return '✦';
}

function tripAccentColor(dest) {
  const d = (dest || '').toLowerCase();
  if (d.includes('japan') || d.includes('kyoto') || d.includes('tokyo')) return 'linear-gradient(180deg,#818cf8,#4f46e5)';
  if (d.includes('mexico') || d.includes('oaxaca')) return 'linear-gradient(180deg,#fb923c,#ea580c)';
  if (d.includes('bali') || d.includes('indonesia')) return 'linear-gradient(180deg,#34d399,#059669)';
  if (d.includes('india') || d.includes('shimla') || d.includes('goa') || d.includes('manali')) return 'linear-gradient(180deg,#fbbf24,#d97706)';
  if (d.includes('france') || d.includes('paris')) return 'linear-gradient(180deg,#60a5fa,#2563eb)';
  if (d.includes('thailand') || d.includes('bangkok')) return 'linear-gradient(180deg,#f472b6,#db2777)';
  if (d.includes('spain') || d.includes('barcelona')) return 'linear-gradient(180deg,#f97316,#c2410c)';
  if (d.includes('italy') || d.includes('rome')) return 'linear-gradient(180deg,#a78bfa,#7c3aed)';
  if (d.includes('portugal')) return 'linear-gradient(180deg,#4ade80,#16a34a)';
  if (d.includes('morocco')) return 'linear-gradient(180deg,#fb923c,#92400e)';
  if (d.includes('nepal')) return 'linear-gradient(180deg,#60a5fa,#1d4ed8)';
  if (d.includes('vietnam')) return 'linear-gradient(180deg,#f87171,#b91c1c)';
  return 'linear-gradient(180deg,#00d4aa,#00916a)';
}

function recCardGradient(i) {
  const g = [
    'linear-gradient(135deg,rgba(167,139,250,0.2),rgba(88,28,135,0.4))',
    'linear-gradient(135deg,rgba(251,146,60,0.2),rgba(154,52,18,0.4))',
    'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(6,78,59,0.4))',
  ];
  return g[i % g.length];
}

function Avatar({ user }) {
  const init = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  if (user?.photoURL) {
    return <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />;
  }
  return <span>{init}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { currentUser, signOut, getIdToken } = useAuth();
  const [profile, setProfile]       = useState(null);
  const [pastTrips, setPastTrips]   = useState([]);
  const [recs, setRecs]             = useState([]);
  const [prefActivities, setPrefActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const h = { Authorization: `Bearer ${token}` };
        const [pRes, rRes] = await Promise.allSettled([
          fetch(`${API_URL}/profile`, { headers: h }),
          fetch(`${API_URL}/recommendations/personalised`, { headers: h }),
        ]);
        if (pRes.status === 'fulfilled' && pRes.value.ok) {
          const d = await pRes.value.json();
          if (d.profile) setProfile(d.profile);
          if (d.pastTrips) setPastTrips(d.pastTrips);
        }
        if (rRes.status === 'fulfilled' && rRes.value.ok) {
          const d = await rRes.value.json();
          if (d.recommendations) setRecs(d.recommendations);
          if (d.preferred_activities) setPrefActivities(d.preferred_activities);
        }
      } catch { /* graceful */ }
      setLoading(false);
    })();
  }, [currentUser]);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const displayName   = profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Explorer';
  const firstName     = displayName.split(' ')[0];
  const totalTrips    = pastTrips.length;
  const totalDays     = pastTrips.reduce((s, t) => s + (parseInt(t.days) || 0), 0);
  const countries     = new Set(pastTrips.map(t => extractCountry(t.destination)).filter(Boolean));
  const countryCount  = countries.size;
  const lastTrip      = pastTrips[0];
  const sinceLastTrip = timeAgo(lastTrip?.createdAt);
  const lastDestName  = lastTrip?.destination?.split(',')[0] || 'your last trip';
  const avgTripDays   = totalTrips > 0 ? (totalDays / totalTrips).toFixed(1) : '–';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const s = {
    page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
    nav: { padding: '14px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,9,15,0.92)', backdropFilter: 'blur(16px)' },
    logo: { display: 'flex', alignItems: 'center', gap: 10 },
    logoMark: { width: 32, height: 32, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#06090f', boxShadow: '0 0 20px rgba(0,212,170,0.3)' },
    logoText: { fontSize: 15, fontWeight: 700 },
    navRight: { display: 'flex', alignItems: 'center', gap: 14 },
    avatar: { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#06090f', overflow: 'hidden', flexShrink: 0 },
    navName: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' },
    signOut: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
    hero: { padding: '52px 36px 44px', position: 'relative', overflow: 'hidden' },
    eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
    heroTitle: { fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.025em', marginBottom: 6 },
    heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 36, fontStyle: 'italic' },
    statsStrip: { display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', maxWidth: 600 },
    stat: { flex: 1, padding: '16px 20px', borderRight: '1px solid rgba(255,255,255,0.06)' },
    statNum: { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, lineHeight: 1, marginBottom: 4 },
    statLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' },
    main: { padding: '0 36px 60px', display: 'grid', gap: 44 },
    secHeader: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 },
    secTitle: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700 },
    secLink: { fontSize: 12, color: '#00d4aa', textDecoration: 'none', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' },
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,400&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.logo}>
          <div style={s.logoMark}>W</div>
          <span style={s.logoText}>WanderZenAI</span>
        </div>
        <div style={s.navRight}>
          <div style={s.avatar}><Avatar user={currentUser} /></div>
          <span style={s.navName}>{firstName}</span>
          <button style={s.signOut} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={s.hero}>
        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -100, left: -100, width: 600, height: 500, background: 'radial-gradient(ellipse,rgba(0,212,170,0.07) 0%,transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: 400, background: 'radial-gradient(ellipse,rgba(96,165,250,0.04) 0%,transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ ...s.eyebrow }}>
          <span style={{ display: 'inline-block', width: 20, height: 1.5, background: '#00d4aa', borderRadius: 2 }} />
          {greeting}
        </div>
        <div style={s.heroTitle}>
          {loading ? 'Loading…' : `${firstName},`}<br />
          <em style={{ fontStyle: 'italic', fontWeight: 300, color: 'transparent', background: 'linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.2))', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
            where next?
          </em>
        </div>
        <div style={s.heroSub}>
          {totalTrips > 0
            ? `${totalTrips} journeys and counting — the world is your slow lane`
            : 'Your slow travel hub — plan your first journey'}
        </div>

        {/* Stats */}
        {!loading && (
          <div style={s.statsStrip}>
            <div style={{ ...s.stat }}>
              <div style={{ ...s.statNum, color: '#00d4aa' }}>{totalTrips}</div>
              <div style={s.statLabel}>Itineraries</div>
            </div>
            <div style={{ ...s.stat }}>
              <div style={s.statNum}>{countryCount}</div>
              <div style={s.statLabel}>Countries</div>
            </div>
            <div style={{ ...s.stat }}>
              <div style={s.statNum}>{totalDays}</div>
              <div style={s.statLabel}>Days planned</div>
            </div>
            <div style={{ ...s.stat, borderRight: 'none' }}>
              <div style={{ ...s.statNum, fontSize: sinceLastTrip ? 18 : 28 }}>{sinceLastTrip || '–'}</div>
              <div style={s.statLabel}>Since last trip</div>
            </div>
          </div>
        )}
      </div>

      <div style={s.main}>

        {/* ── READY FOR NEXT ADVENTURE ── */}
        {!loading && (
          <div>
            <div style={s.secHeader}>
              <div style={s.secTitle}>Ready for your next adventure?</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg,rgba(0,212,170,0.08),rgba(96,165,250,0.05))', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)', fontSize: 80, color: 'rgba(0,212,170,0.04)', pointerEvents: 'none' }}>✦</div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 100, padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 12 }}>
                  <span style={{ width: 6, height: 6, background: '#00d4aa', borderRadius: '50%', animation: 'pulse 2s infinite', boxShadow: '0 0 6px rgba(0,212,170,0.8)' }} />
                  AI Personalised
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, marginBottom: 6 }}>
                  {sinceLastTrip
                    ? `It's been ${sinceLastTrip} since ${lastDestName}.`
                    : 'Your slow travel journey starts here.'}
                  <br />Time to wander again?
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
                  {totalTrips > 1
                    ? `You've averaged a new trip every ${Math.round(30 * totalTrips / Math.max(1, Math.floor((Date.now() - new Date(pastTrips[pastTrips.length - 1]?.createdAt)) / 86400000) / 30))} days`
                    : 'Discover hidden destinations matched to your travel style'}
                </div>
              </div>
              <button
                onClick={() => navigate('/plan')}
                style={{ padding: '14px 28px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,212,170,0.3)', flexShrink: 0, position: 'relative', zIndex: 1 }}
              >
                Plan my next trip →
              </button>
            </div>
          </div>
        )}

        {/* ── RECOMMENDATIONS ── */}
        {recs.length > 0 && (
          <div>
            <div style={s.secHeader}>
              <div style={s.secTitle}>Picked for you</div>
              <button style={s.secLink} onClick={() => navigate('/explore')}>Explore all →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {recs.map((rec, i) => (
                <div
                  key={i}
                  onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: rec.destination?.split(',')[0]?.trim(), lat: 0, lng: 0 }] } } })}
                  style={{ borderRadius: 18, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', transition: 'all 0.25s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(0,212,170,0.3)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ height: 130, background: recCardGradient(i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
                    {rec.emoji || getFlag(rec.destination)}
                  </div>
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{rec.destination}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, marginBottom: 12 }}>{rec.reason}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#00d4aa', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 4, padding: '3px 7px' }}>
                        AI pick
                      </span>
                      <span style={{ fontSize: 16, color: '#00d4aa' }}>→</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRAVEL DNA ── */}
        {!loading && (totalTrips > 0 || prefActivities.length > 0) && (
          <div>
            <div style={s.secHeader}>
              <div style={s.secTitle}>Your travel DNA</div>
              <button style={s.secLink} onClick={() => navigate('/onboarding')}>Edit preferences →</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

              {/* Top activities */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>Top activities</div>
                {prefActivities.length > 0 ? prefActivities.map((act, i) => {
                  const emojis = { Nature:'🌳', Cultural:'🏛️', Foodie:'🍜', Adventure:'🧗', Relaxation:'🌿', Wellness:'🧘', Luxury:'💎' };
                  const width = [90, 70, 50][i] || 40;
                  return (
                    <div key={act} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 16, width: 28, textAlign: 'center', flexShrink: 0 }}>{emojis[act] || '✦'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', flex: 1 }}>{act}</span>
                      <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${width}%`, background: 'linear-gradient(90deg,#00d4aa,#00b896)', borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                }) : (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Plan more trips to build your DNA</div>
                )}
              </div>

              {/* Trip stats */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>Trip patterns</div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: '#00d4aa', lineHeight: 1, marginBottom: 4 }}>
                    {avgTripDays}<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}> days</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Average trip length</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>🌍</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{countryCount} countr{countryCount !== 1 ? 'ies' : 'y'} explored</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>across {totalTrips} journeys</div>
                    </div>
                  </div>
                  {profile?.home_city && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>📍</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Based in {profile.home_city}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Your home base</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Countries visited */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>Countries visited</div>
                {countryCount > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[...countries].slice(0, 8).map(c => (
                      <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                        {getFlag(c)} {c}
                      </span>
                    ))}
                    {countryCount > 8 && (
                      <span style={{ padding: '5px 10px', borderRadius: 20, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', fontSize: 11, fontWeight: 600, color: '#00d4aa' }}>
                        +{countryCount - 8} more
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Your passport awaits its first stamp</div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── PAST TRIPS ── */}
        <div>
          <div style={s.secHeader}>
            <div style={s.secTitle}>Your journeys</div>
            {pastTrips.length > 4 && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{pastTrips.length} total</span>
            )}
          </div>

          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading your trips…</div>
          ) : pastTrips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌍</div>
              <div style={{ fontSize: 16, fontFamily: "'Fraunces', serif", fontWeight: 700, marginBottom: 8 }}>No journeys yet</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Your slow travel story starts here</div>
              <button onClick={() => navigate('/plan')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                Plan your first trip →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pastTrips.map(trip => (
                <div
                  key={trip.id}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                  <div style={{ width: 5, height: 72, background: tripAccentColor(trip.destination), flexShrink: 0 }} />
                  <div style={{ width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                    {getFlag(trip.destination)}
                  </div>
                  <div style={{ flex: 1, padding: '14px 0' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>{trip.destination}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {trip.days} day{trip.days !== 1 ? 's' : ''} · {formatDate(trip.createdAt)}
                    </div>
                  </div>
                  <div style={{ padding: '0 8px' }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 5, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                      ...(trip.status === 'email_sent'
                        ? { background: 'rgba(0,212,170,0.1)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.2)' }
                        : { background: 'rgba(255,217,61,0.08)', color: '#ffd93d', border: '1px solid rgba(255,217,61,0.15)' })
                    }}>
                      {trip.status === 'email_sent' ? 'Completed' : 'Processing'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 20px', alignItems: 'center', flexShrink: 0 }}>
                    {trip.pdfUrl && (
                      <a
                        href={trip.pdfUrl} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '7px 14px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#00d4aa', textDecoration: 'none', cursor: 'pointer' }}
                      >
                        📥 PDF
                      </a>
                    )}
                    <button
                      onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: trip.destination?.split(',')[0]?.trim(), lat: 0, lng: 0 }] } } })}
                      style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Re-plan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.75)}}`}</style>
    </div>
  );
}
