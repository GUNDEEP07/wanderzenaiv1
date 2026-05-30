import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const SUGGESTIONS = [
  'Help me plan my next trip',
  'What\'s the best time to visit Vietnam?',
  'Hidden gems near Kyoto off the tourist trail',
  'Budget tips for slow travel in Southeast Asia',
  'Best street food cities in Asia',
];

export function TravelChat() {
  const [open, setOpen]         = useState(false);
  const [input, setInput]       = useState('');
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [pendingTrip, setPendingTrip] = useState(null);
  const { getIdToken }          = useAuth();
  const navigate                = useNavigate();
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const newHistory = [...history, { role: 'user', content: msg }];
    setHistory(newHistory);
    setLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/recommendations/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, history: history.slice(-8) }),
      });
      const data = await res.json();
      setHistory(h => [...h, { role: 'assistant', content: data.reply || 'Sorry, something went wrong.' }]);
      if (data.readyToPlan && data.tripData) {
        setPendingTrip(data.tripData);
      }
    } catch {
      setHistory(h => [...h, { role: 'assistant', content: 'I\'m having trouble connecting right now. Try again in a moment.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#00d4aa,#00a87e)',
          border: open ? '1px solid rgba(255,255,255,0.2)' : 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? 'none' : '0 4px 24px rgba(0,212,170,0.4)',
          transition: 'all 0.25s',
          fontSize: 22,
        }}
        title="Chat with your AI travel advisor"
      >
        {open ? '✕' : '✦'}
      </button>

      {/* Chat panel */}
      <div style={{
        position: 'fixed', bottom: 96, right: 28, zIndex: 999,
        width: 380, height: 560,
        background: 'rgba(10,14,24,0.97)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>

        {/* Header */}
        <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 0 12px rgba(0,212,170,0.3)' }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>AI Travel Advisor</div>
            <div style={{ fontSize: 10, color: '#00d4aa', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, background: '#00d4aa', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Knows your travel history
            </div>
          </div>
          <button
            onClick={() => { setHistory([]); setPendingTrip(null); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
            title="Clear chat"
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>

          {history.length === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🌍</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Your personal travel advisor</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>Ask me anything — itineraries, tips,<br />hidden gems, best times to visit</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    style={{
                      padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(0,212,170,0.07)'; e.target.style.borderColor = 'rgba(0,212,170,0.2)'; e.target.style.color = '#fff'; }}
                    onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.04)'; e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.color = 'rgba(255,255,255,0.65)'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0, marginRight: 8, marginTop: 2 }}>✦</div>
              )}
              <div style={{
                maxWidth: '78%', padding: '10px 13px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg,#00d4aa,#00a87e)' : 'rgba(255,255,255,0.06)',
                border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                fontSize: 13, lineHeight: 1.55,
                color: msg.role === 'user' ? '#06090f' : 'rgba(255,255,255,0.85)',
                fontWeight: msg.role === 'user' ? 600 : 400,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>✦</div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4aa', animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Plan this trip CTA */}
        {pendingTrip && (
          <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
            <button
              onClick={() => {
                const dest = pendingTrip.destination?.split(',')[0]?.trim();
                navigate('/plan', {
                  state: {
                    prefill: {
                      destinations: dest ? [{ name: dest, lat: 0, lng: 0 }] : [],
                      days: pendingTrip.days || 5,
                      travelDate: pendingTrip.travelDate || '',
                      travelerType: pendingTrip.travelerType || '',
                      travelStyle: pendingTrip.travelStyle || [],
                      budget: pendingTrip.budget === 'Budget' ? '1500' : pendingTrip.budget === 'Mid-range' ? '3000' : '6000',
                      currency: pendingTrip.currency || 'USD',
                    },
                  },
                });
                setOpen(false);
              }}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg,#00d4aa,#00a87e)', cursor: 'pointer',
                color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                boxShadow: '0 4px 18px rgba(0,212,170,0.35)', marginBottom: 8,
              }}
            >
              ✦ Yes, plan this trip for me →
            </button>
            <button
              onClick={() => setPendingTrip(null)}
              style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', paddingBottom: 4 }}
            >
              No, let's keep chatting
            </button>
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <form onSubmit={e => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about any destination…"
              disabled={loading}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: '#fff', fontFamily: 'inherit', fontSize: 13, outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: 10, border: 'none',
                background: input.trim() && !loading ? 'linear-gradient(135deg,#00d4aa,#00a87e)' : 'rgba(255,255,255,0.08)',
                color: input.trim() && !loading ? '#06090f' : 'rgba(255,255,255,0.3)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              ↑
            </button>
          </form>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 8 }}>
            Powered by Claude · Personalised to your travel history
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }
      `}</style>
    </>
  );
}
