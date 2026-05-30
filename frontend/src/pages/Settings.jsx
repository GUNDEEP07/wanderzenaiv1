import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { auth, FIREBASE_CONFIGURED } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL;

const CURRENCIES = ['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)', 'AUD (A$)', 'CAD (C$)', 'SGD (S$)', 'JPY (¥)'];
const LANGUAGES  = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Portuguese', 'Italian'];

const s = {
  page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '14px 36px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(6,9,15,0.92)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  navTitle: { fontSize: 15, fontWeight: 700 },
  inner: { maxWidth: 720, margin: '0 auto', padding: '36px 24px 60px' },
  pageTitle: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, marginBottom: 6 },
  pageSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, fontStyle: 'italic' },
  tabs: { display: 'flex', gap: 4, marginBottom: 32, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 4 },
  tab: (active) => ({
    flex: 1, padding: '9px 12px', border: 'none', borderRadius: 9, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 700 : 500, transition: 'all 0.15s',
    background: active ? 'rgba(0,212,170,0.12)' : 'transparent',
    color: active ? '#00d4aa' : 'rgba(255,255,255,0.45)',
    borderColor: active ? 'rgba(0,212,170,0.25)' : 'transparent',
    borderStyle: 'solid', borderWidth: 1,
  }),
  section: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 28px', marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 18, letterSpacing: '0.02em' },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 7 },
  input: { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 14 },
  select: { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer', boxSizing: 'border-box', marginBottom: 14 },
  genderRow: { display: 'flex', gap: 8, marginBottom: 14 },
  gBtn: (sel) => ({ flex: 1, padding: '10px', border: `1.5px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`, background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)', color: sel ? '#00d4aa' : 'rgba(255,255,255,0.5)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400, transition: 'all 0.15s' }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  saveBtn: { padding: '12px 28px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 11, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,212,170,0.25)', transition: 'all 0.2s' },
  success: { background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#00d4aa', marginBottom: 14 },
  error: { background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ff6b6b', marginBottom: 14 },
  planCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  planBadge: (active) => ({ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: active ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.06)', color: active ? '#00d4aa' : 'rgba(255,255,255,0.4)', border: `1px solid ${active ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.1)'}` }),
  upgradeBtn: { padding: '10px 20px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 10, color: '#06090f', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  dangerBtn: { padding: '10px 20px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 10, color: '#ff6b6b', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  divider: { height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' },
};

export default function Settings() {
  const [tab, setTab] = useState('profile');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [name, setName]         = useState('');
  const [age, setAge]           = useState('');
  const [gender, setGender]     = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [language, setLanguage] = useState('English');
  const [currency, setCurrency] = useState('USD ($)');

  // Account
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const { currentUser, getIdToken, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json();
        if (d.profile) {
          const p = d.profile;
          setName(p.name || currentUser.displayName || '');
          setAge(p.age ? String(p.age) : '');
          setGender(p.gender || '');
          setWhatsapp(p.whatsapp || '');
          setHomeCity(p.home_city || '');
          setLanguage(p.language || 'English');
        }
      } catch { /* graceful */ }
    })();
  }, [currentUser]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, age: age ? parseInt(age) : null, gender: gender || null, whatsapp: whatsapp || null, home_city: homeCity || null, language }),
      });
      if (res.ok) showMsg('success', 'Profile saved successfully');
      else showMsg('error', 'Failed to save. Try again.');
    } catch { showMsg('error', 'Failed to save. Try again.'); }
    setSaving(false);
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language }),
      });
      showMsg('success', 'Preferences saved');
    } catch { showMsg('error', 'Failed to save.'); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!FIREBASE_CONFIGURED) { showMsg('error', 'Firebase not configured yet.'); return; }
    if (newPw !== confirmPw) { showMsg('error', 'New passwords do not match.'); return; }
    if (newPw.length < 6) { showMsg('error', 'Password must be at least 6 characters.'); return; }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPw);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showMsg('success', 'Password changed successfully');
    } catch (err) {
      if (err.code === 'auth/wrong-password') showMsg('error', 'Current password is incorrect.');
      else showMsg('error', 'Failed to change password. Try again.');
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone.')) return;
    try {
      await deleteUser(auth.currentUser);
      navigate('/signup');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        showMsg('error', 'Please sign out and sign in again before deleting your account.');
      } else {
        showMsg('error', 'Failed to delete account. Try again.');
      }
    }
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900&display=swap');
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus, select:focus { border-color: rgba(0,212,170,0.4) !important; }
        select option { background: #111827; color: #fff; }
      `}</style>

      <nav style={s.nav}>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>&larr; Dashboard</button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span style={s.navTitle}>Settings</span>
      </nav>

      <div style={s.inner}>
        <div style={s.pageTitle}>Settings</div>
        <div style={s.pageSub}>Manage your profile, preferences and subscription</div>

        {/* Tabs */}
        <div style={s.tabs}>
          {[['profile','Profile'],['preferences','Preferences'],['subscription','Subscription'],['account','Account']].map(([id, label]) => (
            <button key={id} style={s.tab(tab === id)} onClick={() => { setTab(id); setMsg({ type: '', text: '' }); }}>{label}</button>
          ))}
        </div>

        {msg.text && <div style={msg.type === 'success' ? s.success : s.error}>{msg.text}</div>}

        {/* PROFILE */}
        {tab === 'profile' && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Personal information</div>
              <label style={s.label}>Full name</label>
              <input style={s.input} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              <div style={s.grid2}>
                <div>
                  <label style={s.label}>Age</label>
                  <input style={s.input} type="number" min="16" max="99" placeholder="e.g. 28" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div>
                  <label style={s.label}>WhatsApp <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
                  <input style={s.input} type="text" placeholder="+61 4xx xxx xxx" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                </div>
              </div>
              <label style={s.label}>Gender</label>
              <div style={s.genderRow}>
                {['Male','Female','Other','Prefer not to say'].map(g => (
                  <button key={g} type="button" style={s.gBtn(gender === g)} onClick={() => setGender(g)}>{g}</button>
                ))}
              </div>
              <label style={s.label}>Home city</label>
              <input style={s.input} type="text" placeholder="Sydney, Australia" value={homeCity} onChange={e => setHomeCity(e.target.value)} />
            </div>
            <button style={s.saveBtn} onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </>
        )}

        {/* PREFERENCES */}
        {tab === 'preferences' && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Travel defaults</div>
              <label style={s.label}>Preferred currency</label>
              <select style={s.select} value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <label style={s.label}>Itinerary language</label>
              <select style={s.select} value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Notifications</div>
              {[
                ['Trip ready', 'Email when your itinerary PDF is ready', true],
                ['Weekly inspiration', 'Destination ideas based on your travel style', false],
                ['Travel tips', 'Personalised slow travel tips and guides', false],
              ].map(([label, sub, defaultChecked]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{sub}</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0 }}>
                    <input type="checkbox" defaultChecked={defaultChecked} style={{ opacity: 0, width: 0, height: 0 }} onChange={() => {}} />
                    <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: defaultChecked ? '#00d4aa' : 'rgba(255,255,255,0.15)', borderRadius: 22, transition: '0.2s' }} />
                  </label>
                </div>
              ))}
            </div>
            <button style={s.saveBtn} onClick={savePreferences} disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </>
        )}

        {/* SUBSCRIPTION */}
        {tab === 'subscription' && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Current plan</div>
              <div style={s.planCard}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Free Plan</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>1 itinerary per month · PDF download included</div>
                </div>
                <span style={s.planBadge(true)}>Active</span>
              </div>
              <div style={s.planCard}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Single Trip &mdash; $7</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>One additional itinerary · no subscription</div>
                </div>
                <a href={import.meta.env.VITE_STRIPE_SINGLE_PLAN_LINK} target="_blank" rel="noreferrer">
                  <button style={s.upgradeBtn}>Buy now</button>
                </a>
              </div>
              <div style={s.planCard}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Wanderer &mdash; $9/mo</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Unlimited itineraries · priority generation</div>
                </div>
                <a href={import.meta.env.VITE_STRIPE_WANDERER_LINK} target="_blank" rel="noreferrer">
                  <button style={s.upgradeBtn}>Upgrade</button>
                </a>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>Usage</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Total itineraries generated</span>
                <span style={{ fontWeight: 700 }}>&mdash;</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Member since</span>
                <span style={{ fontWeight: 700 }}>
                  {currentUser?.metadata?.creationTime
                    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
                    : '—'}
                </span>
              </div>
            </div>
          </>
        )}

        {/* ACCOUNT */}
        {tab === 'account' && (
          <>
            <div style={s.section}>
              <div style={s.sectionTitle}>Account details</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Email address</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{currentUser?.email}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Sign-in method</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00d4aa' }}>
                {currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email & password'}
              </div>
            </div>

            {currentUser?.providerData?.[0]?.providerId !== 'google.com' && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Change password</div>
                <label style={s.label}>Current password</label>
                <input style={s.input} type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
                <label style={s.label}>New password</label>
                <input style={s.input} type="password" placeholder="New password (min 6 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
                <label style={s.label}>Confirm new password</label>
                <input style={s.input} type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                <button style={s.saveBtn} onClick={changePassword} disabled={saving || !currentPw || !newPw || !confirmPw}>
                  {saving ? 'Updating…' : 'Change password'}
                </button>
              </div>
            )}

            <div style={s.section}>
              <div style={s.sectionTitle}>Sign out</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>Sign out of your account on this device.</div>
              <button style={s.dangerBtn} onClick={async () => { await signOut(); navigate('/login'); }}>Sign out</button>
            </div>

            <div style={{ ...s.section, borderColor: 'rgba(255,107,107,0.15)' }}>
              <div style={{ ...s.sectionTitle, color: '#ff6b6b' }}>Danger zone</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
                Permanently delete your account and all associated data. This cannot be undone.
              </div>
              <button style={s.dangerBtn} onClick={handleDeleteAccount}>Delete my account</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
