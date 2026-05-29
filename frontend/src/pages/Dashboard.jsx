import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function getFlag(dest) {
  if (!dest) return '✦';
  const d = dest.toLowerCase();
  const map = { japan: '🇯🇵', mexico: '🇲🇽', india: '🇮🇳', france: '🇫🇷', germany: '🇩🇪', thailand: '🇹🇭', indonesia: '🇮🇩', australia: '🇦🇺', italy: '🇮🇹', spain: '🇪🇸', usa: '🇺🇸', 'united states': '🇺🇸', uk: '🇬🇧', portugal: '🇵🇹', morocco: '🇲🇦', vietnam: '🇻🇳', peru: '🇵🇪', nepal: '🇳🇵', greece: '🇬🇷' };
  for (const [k, v] of Object.entries(map)) { if (d.includes(k)) return v; }
  return '✦';
}

function Avatar({ user }) {
  const init = (user?.displayName || user?.email || 'U')[0].toUpperCase();
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#06090f', overflow: 'hidden', flexShrink: 0 }}>
      {user?.photoURL
        ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : init}
    </div>
  );
}

export default function Dashboard() {
  const { currentUser, signOut, getIdToken } = useAuth();
  const [profile, setProfile]     = useState(null);
  const [pastTrips, setPastTrips] = useState([]);
  const [recs, setRecs]           = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, recsRes] = await Promise.allSettled([
          fetch(`${API_URL}/profile`, { headers }),
          fetch(`${API_URL}/recommendations/personalised`, { headers }),
        ]);

        if (profileRes.status === 'fulfilled') {
          const d = await profileRes.value.json();
          if (d.profile) setProfile(d.profile);
          if (d.pastTrips) setPastTrips(d.pastTrips);
        }
        if (recsRes.status === 'fulfilled') {
          const d = await recsRes.value.json();
          if (d.recommendations) setRecs(d.recommendations);
        }
      } catch { /* graceful */ }
      setLoadingData(false);
    })();
  }, [currentUser]);

  const handleSignOut = async () => { await signOut(); navigate('/login'); };
  const displayName = profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Explorer';

  return (
    <div style={{ minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,300&display=swap');`}</style>

      {/* Nav */}
      <nav style={{ padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#06090f' }}>W</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>WanderZenAI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar user={currentUser} />
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Sign out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>

        {/* Greeting */}
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, marginBottom: 4 }}>
          Hey, {displayName.split(' ')[0]} ✦
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36, fontStyle: 'italic' }}>
          Welcome back to your slow travel hub
        </div>

        {/* Plan new trip CTA */}
        <div
          onClick={() => navigate('/plan')}
          style={{ background: 'linear-gradient(135deg,rgba(0,212,170,0.12),rgba(0,168,126,0.08))', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 44, cursor: 'pointer', transition: 'border-color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,212,170,0.5)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0,212,170,0.25)'}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#00d4aa', marginBottom: 4 }}>✦ Plan a new trip</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>AI-powered · slow travel · no tourist traps</div>
          </div>
          <div style={{ fontSize: 22, color: '#00d4aa' }}>→</div>
        </div>

        {/* Recommended for you */}
        {recs.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 14 }}>Recommended for you</div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
              {recs.map((rec, i) => (
                <div
                  key={i}
                  onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 }] } } })}
                  style={{ flexShrink: 0, minWidth: 200, background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{rec.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{rec.destination}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: 12 }}>{rec.reason}</div>
                  <div style={{ fontSize: 11, color: '#00d4aa', fontWeight: 700 }}>Plan this trip →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past trips */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 14 }}>Your trips</div>

        {loadingData ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading your trips…</div>
        ) : pastTrips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌍</div>
            <div style={{ fontSize: 15 }}>No trips yet</div>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              <span style={{ color: '#00d4aa', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/plan')}>
                Plan your first trip →
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {pastTrips.map(trip => (
              <div key={trip.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: trip.status === 'email_sent' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.06)', color: trip.status === 'email_sent' ? '#00d4aa' : 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                  {trip.status === 'email_sent' ? 'Completed' : 'Processing'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {getFlag(trip.destination)} {trip.destination}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>
                  {trip.days} days · {formatDate(trip.createdAt)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {trip.pdfUrl && (
                    <a href={trip.pdfUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 7, fontSize: 11, color: '#00d4aa', textDecoration: 'none', fontFamily: 'inherit' }}>
                      📥 PDF
                    </a>
                  )}
                  <button
                    style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: trip.destination, lat: 0, lng: 0 }] } } })}
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
  );
}
