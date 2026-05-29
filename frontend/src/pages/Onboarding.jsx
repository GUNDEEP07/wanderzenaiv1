import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const CURRENCIES = ['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)', 'AUD (A$)', 'CAD (C$)', 'SGD (S$)', 'JPY (¥)'];
const LANGUAGES  = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Portuguese', 'Italian'];

const s = {
  page:     { minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' },
  box:      { width: '100%', maxWidth: 420 },
  progress: { display: 'flex', gap: 5, marginBottom: 28 },
  seg:      (on) => ({ flex: 1, height: 3, borderRadius: 2, background: on ? '#00d4aa' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }),
  eyebrow:  { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 6 },
  title:    { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 6 },
  sub:      { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: 28 },
  label:    { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 7 },
  input:    { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 20, boxSizing: 'border-box' },
  select:   { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 20, appearance: 'none', cursor: 'pointer', boxSizing: 'border-box' },
  row2:     { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 20 },
  genderRow:{ display: 'flex', gap: 8, marginBottom: 20 },
  gBtn:     (sel) => ({ flex: 1, padding: '10px', border: `1.5px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`, background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)', color: sel ? '#00d4aa' : 'rgba(255,255,255,0.5)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400, transition: 'all 0.15s' }),
  btn:      { width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,212,170,0.25)', marginBottom: 12, boxSizing: 'border-box' },
  skip:     { width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.1)', textUnderlineOffset: 3 },
};

export default function Onboarding() {
  const [screen, setScreen]       = useState(1);
  const [name, setName]           = useState('');
  const [age, setAge]             = useState('');
  const [gender, setGender]       = useState('');
  const [whatsapp, setWhatsapp]   = useState('');
  const [homeCity, setHomeCity]   = useState('');
  const [currency, setCurrency]   = useState('AUD (A$)');
  const [language, setLanguage]   = useState('English');
  const [saving, setSaving]       = useState(false);
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const saveProfile = async (complete) => {
    setSaving(true);
    try {
      const token = await getIdToken();
      await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:               name || currentUser?.displayName || '',
          age:                age ? parseInt(age, 10) : null,
          gender:             gender || null,
          whatsapp:           whatsapp || null,
          home_city:          homeCity || null,
          language,
          firebase_uid:       currentUser?.uid || null,
          onboarding_complete: complete,
        }),
      });
    } catch { /* graceful — demo mode or network */ }
    setSaving(false);
  };

  const handleNext = async () => { await saveProfile(false); setScreen(2); };
  const handleFinish = async () => { await saveProfile(true); navigate('/dashboard'); };
  const handleSkip = async () => { await saveProfile(screen === 2); navigate('/dashboard'); };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900&display=swap');
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus, select:focus { border-color: rgba(0,212,170,0.4) !important; }
        select option { background: #111827; color: #fff; }
      `}</style>
      <div style={s.box}>
        <div style={s.progress}>
          <div style={s.seg(true)} />
          <div style={s.seg(screen === 2)} />
        </div>

        {screen === 1 ? (
          <>
            <div style={s.eyebrow}>1 of 2 · About you</div>
            <div style={s.title}>Who are you?</div>
            <div style={s.sub}>Helps us personalise every itinerary</div>

            <label style={s.label}>Your name</label>
            <input style={s.input} placeholder={currentUser?.displayName || 'Full name'} value={name} onChange={e => setName(e.target.value)} />

            <div style={s.row2}>
              <div>
                <label style={s.label}>Age</label>
                <input style={{ ...s.input, marginBottom: 0 }} type="number" min="16" max="99" placeholder="e.g. 28" value={age} onChange={e => setAge(e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Gender</label>
                <div style={s.genderRow}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} style={s.gBtn(gender === g)} onClick={() => setGender(g)} type="button">{g}</button>
                  ))}
                </div>
              </div>
            </div>

            <label style={s.label}>
              WhatsApp&nbsp;
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)' }}>(optional)</span>
            </label>
            <input style={s.input} placeholder="+61 4xx xxx xxx" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />

            <button style={s.btn} onClick={handleNext} disabled={saving} type="button">{saving ? '…' : 'Next →'}</button>
            <button style={s.skip} onClick={handleSkip} type="button">Skip for now</button>
          </>
        ) : (
          <>
            <div style={s.eyebrow}>2 of 2 · Your defaults</div>
            <div style={s.title}>Travel preferences</div>
            <div style={s.sub}>Pre-fills your trips so you type less</div>

            <label style={s.label}>Home city</label>
            <input style={s.input} placeholder="Sydney, Australia" value={homeCity} onChange={e => setHomeCity(e.target.value)} />

            <label style={s.label}>Preferred currency</label>
            <select style={s.select} value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <label style={s.label}>Itinerary language</label>
            <select style={s.select} value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>

            <button style={s.btn} onClick={handleFinish} disabled={saving} type="button">
              {saving ? '…' : "Let's explore →"}
            </button>
            <button style={s.skip} onClick={handleSkip} type="button">Skip for now</button>
          </>
        )}
      </div>
    </div>
  );
}
