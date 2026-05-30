import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

function ActivityCard({ activity, period, emoji }) {
  if (!activity) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa' }}>{period}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{activity.time}</div>
        </div>
        {!activity.isFree && activity.cost > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
            ~${activity.cost}
          </div>
        )}
        {activity.isFree && (
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#00d4aa', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 4, padding: '2px 7px' }}>Free</div>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 6, lineHeight: 1.4 }}>{activity.venueName || activity.location}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginBottom: 8 }}>{activity.activity}</div>
      {activity.why && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', lineHeight: 1.45, borderLeft: '2px solid rgba(0,212,170,0.3)', paddingLeft: 10, marginBottom: 8 }}>
          {activity.why}
        </div>
      )}
      {activity.insiderTip && (
        <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span>💡</span>
          <span>{activity.insiderTip}</span>
        </div>
      )}
      {activity.venue?.mapsUrl && (
        <a href={activity.venue.mapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: '#00d4aa', textDecoration: 'none', fontWeight: 600 }}>
          📍 View on maps →
        </a>
      )}
    </div>
  );
}

export default function ItineraryView() {
  const { id } = useParams();
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_URL}/itinerary?id=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Could not load itinerary');
        const d = await res.json();
        setData(d);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        Loading itinerary…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#06090f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Itinerary not found</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>This itinerary may still be generating or doesn't exist.</div>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const itin = data.itinerary;
  const totalCost = itin?.days?.reduce((s, d) => s + (d.dailyCost || 0), 0) || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Nav */}
      <nav style={{ padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Dashboard</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{data.destination}</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {data.days} days · {new Date(data.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: '48px 28px 36px', maxWidth: 860, margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -40, left: -60, width: 400, height: 300, background: 'radial-gradient(ellipse,rgba(0,212,170,0.07),transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 18, height: 1.5, background: '#00d4aa', display: 'inline-block', borderRadius: 2 }} />
          Your slow travel itinerary
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.025em', marginBottom: 14, color: '#fff' }}>
          {itin?.title || `${data.destination} — ${data.days} Day Itinerary`}
        </h1>
        {itin?.summary && (
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, maxWidth: 680, marginBottom: 24, fontStyle: 'italic' }}>
            {itin.summary}
          </p>
        )}
        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
            📅 {data.days} days
          </span>
          {totalCost > 0 && (
            <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              💰 ~${totalCost} estimated
            </span>
          )}
          <span style={{ padding: '6px 14px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#00d4aa' }}>
            ✦ AI-curated · no tourist traps
          </span>
        </div>
      </div>

      {/* Days */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px 80px' }}>
        {(itin?.days || []).map((day, i) => (
          <div key={i} style={{ marginBottom: 48 }}>
            {/* Day header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg,rgba(0,212,170,0.15),rgba(0,168,126,0.05))', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#00d4aa' }}>{day.dayNumber}</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Day {day.dayNumber}</div>
                {day.theme && <div style={{ fontSize: 13, color: '#00d4aa', fontStyle: 'italic' }}>{day.theme}</div>}
              </div>
              {day.dailyCost > 0 && (
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Est. daily cost</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>${day.dailyCost}</div>
                </div>
              )}
            </div>

            {/* Activities */}
            <ActivityCard activity={day.morningActivity} period="Morning" emoji="🌅" />
            <ActivityCard activity={day.afternoonActivity} period="Afternoon" emoji="☀️" />
            <ActivityCard activity={day.eveningActivity} period="Evening" emoji="🌙" />

            {/* Local eats */}
            {day.localEats && (
              <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 14, padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fb923c', marginBottom: 8 }}>🍜 Local Eat</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{day.localEats.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6, fontStyle: 'italic' }}>"{day.localEats.dish}"</div>
                {day.localEats.vibe && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{day.localEats.vibe}</div>}
                {day.localEats.cost > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>~${day.localEats.cost}</div>}
              </div>
            )}

            {/* Hidden gem */}
            {day.hiddenGem && (
              <div style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💎</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 4 }}>Hidden Gem</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{day.hiddenGem}</div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Made with WanderZenAI · slow travel, no tourist traps</div>
          <button onClick={() => navigate('/plan')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Plan another trip →
          </button>
        </div>
      </div>
    </div>
  );
}
