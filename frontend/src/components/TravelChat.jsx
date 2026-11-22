import { useState, useRef, useEffect } from 'react';

function ChatFeedback({ destination }) {
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return (
    <div style={{ fontSize: 12, color: '#00d4aa', padding: '8px 12px', background: 'rgba(0,212,170,0.08)', borderRadius: 10 }}>
      Thanks for the feedback! ✓
    </div>
  );
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>✨ How has our chat been so far?</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={async () => {
            setRating(n); setDone(true);
            try {
              await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: n, destination, source: 'chat' }),
              });
            } catch { /* silent */ }
          }} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', opacity: n <= rating ? 1 : 0.4, transition: 'opacity 0.1s' }}>
            ⭐
          </button>
        ))}
      </div>
    </div>
  );
}
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';
import { chatTripToPrefill } from '../utils/chatHandoff';
import { companionTrips, tripPlace, tripSuggestions } from '../utils/companion';

const API_URL = import.meta.env.VITE_API_URL;

const SUGGESTIONS = [
  'Help me plan my next trip',
  'What\'s the best time to visit Vietnam?',
  'Hidden gems near Kyoto off the tourist trail',
  'Budget tips for slow travel in Southeast Asia',
  'Best street food cities in Asia',
];

export function TravelChat({ trips = [] }) {
  // Trip companion: with an upcoming trip the chat answers questions about it; "New trip" switches
  // to the planning chat. The backend re-checks the trip belongs to this user.
  const choices = companionTrips(trips);
  const [tripId, setTripId]     = useState(null);
  const trip = choices.find((t) => t.id === tripId) || choices[0] || null;
  const [mode, setMode]         = useState('trip');
  const tripMode                = !!trip && mode === 'trip';
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
        // Send newHistory (including current message) so Claude has full context
        body: JSON.stringify({ message: msg, history: newHistory.slice(-10), ...(tripMode ? { mode: 'trip', tripId: trip.id } : { mode: 'plan' }) }),
      });
      const data = await res.json();
      const fullReply = data.reply || 'Sorry, something went wrong.';

      // Re-enable input before streaming so user can type while text appears
      setLoading(false);

      // Simulate streaming: add assistant message with empty content, then fill word by word
      setHistory(h => [...h, { role: 'assistant', content: '' }]);
      const words = fullReply.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(r => setTimeout(r, 35));
        setHistory(h => {
          const updated = [...h];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: words.slice(0, i + 1).join(' '),
          };
          return updated;
        });
      }

      if (data.readyToPlan && data.tripData) {
        setPendingTrip(data.tripData);
        setTimeout(() => {
          setHistory(h => [...h, { role: 'assistant', content: '✨ How has our chat been?', isFeedbackPrompt: true, destination: data.tripData?.destination }]);
        }, 800);
      }
    } catch {
      setLoading(false);
      setHistory(h => [...h, { role: 'assistant', content: 'I\'m having trouble connecting right now. Try again in a moment.' }]);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { const next = !open; setOpen(next); if (next) analytics.chatOpened(); }}
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
        // Fits short windows and phones: the header was cut off below ~680 px tall.
        width: 'min(380px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 120px))',
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
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{tripMode ? 'Trip companion' : 'AI Travel Advisor'}</div>
            <div style={{ fontSize: 10, color: '#00d4aa', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, background: '#00d4aa', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              {tripMode ? `Knows your ${tripPlace(trip)} trip, day by day` : 'Plans your next trip with you'}
            </div>
          </div>
          <button
            onClick={() => { setHistory([]); setPendingTrip(null); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
            title="Clear chat"
          >
            Clear
          </button>
        </div>

        {trip && (
          <div role="tablist" aria-label="What to chat about" style={{ display: 'flex', gap: 6, padding: '10px 16px 0', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['trip', `Your ${tripPlace(trip)} trip`], ['plan', 'New trip']].map(([m, label]) => {
              const on = (m === 'trip') === tripMode;
              return (
                <button key={m} type="button" role="tab" aria-selected={on}
                  onClick={() => { if (!on) { setMode(m); setHistory([]); setPendingTrip(null); } }}
                  style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${on ? 'rgba(0,212,170,0.5)' : 'rgba(255,255,255,0.12)'}`, background: on ? 'rgba(0,212,170,0.12)' : 'transparent', color: on ? '#00d4aa' : 'rgba(255,255,255,0.7)' }}>
                  {label}
                </button>
              );
            })}
            {tripMode && choices.length > 1 && (
              <select aria-label="Which trip" value={trip.id}
                onChange={(e) => { setTripId(e.target.value); setHistory([]); setPendingTrip(null); }}
                style={{ marginLeft: 'auto', maxWidth: 150, padding: '5px 8px', borderRadius: 8, background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', fontFamily: 'inherit', fontSize: 12 }}>
                {choices.map((t) => (
                  <option key={t.id} value={t.id}>{tripPlace(t)}{t.travelDate ? ` · ${new Date(`${t.travelDate}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' }}>

          {history.length === 0 && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>{tripMode ? '🧭' : '🌍'}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{tripMode ? `Ask anything about your ${tripPlace(trip)} trip` : 'Your personal travel advisor'}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {tripMode ? <>Packing, getting around, rainy-day swaps,<br />what to book ahead — I know every day you planned.</> : <>Ask me anything — itineraries, tips,<br />hidden gems, best times to visit</>}
                </div>
              </div>
              <div
                className="travel-chat-suggestions"
                style={{
                  display: 'flex', flexDirection: 'row', gap: 8,
                  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none', paddingBottom: 4,
                }}
              >
                {(tripMode ? tripSuggestions(trip) : SUGGESTIONS).map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => send(s)}
                    style={{
                      padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,170,0.07)'; e.currentTarget.style.borderColor = 'rgba(0,212,170,0.2)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
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
              {msg.isFeedbackPrompt ? (
                <ChatFeedback destination={msg.destination} />
              ) : (
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
              )}
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
                // Step 1, pre-filled — so "Who's travelling?" (kids!) and the budget get a check.
                navigate('/plan', { state: { startStep: 0, prefill: chatTripToPrefill(pendingTrip) } });
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
              style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', paddingBottom: 4 }}
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
              placeholder={tripMode ? `Ask about your ${tripPlace(trip)} trip…` : 'Ask about any destination…'}
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
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 8 }}>
            {tripMode ? 'Powered by Claude · Check opening hours and timetables before you go' : 'Powered by Claude · Personalised to your travel history'}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }
        .travel-chat-suggestions::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}
