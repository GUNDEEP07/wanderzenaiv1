import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';

const s = {
  page: { minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: '100%', maxWidth: 400, padding: '0 24px' },
  logo: { width: 40, height: 40, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#06090f', margin: '0 auto 16px' },
  headline: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1, marginBottom: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontStyle: 'italic', marginBottom: 32 },
  googleBtn: { width: '100%', padding: '12px', background: '#fff', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111', fontFamily: 'inherit', marginBottom: 20, boxSizing: 'border-box' },
  divider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 16, boxShadow: '0 4px 18px rgba(0,212,170,0.25)', boxSizing: 'border-box' },
  footer: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 14 },
  link: { color: '#00d4aa', textDecoration: 'none', fontWeight: 600 },
  error: { background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff6b6b', marginBottom: 12 },
  success: { background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#00d4aa', marginBottom: 12 },
  demo: { background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'rgba(0,212,170,0.7)', marginBottom: 16, textAlign: 'center' },
  resetBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px', marginTop: 4 },
  resetTitle: { fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  resetBtn: { width: '100%', padding: '10px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 10, color: '#00d4aa', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', boxSizing: 'border-box' },
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Login() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showReset, setShowReset]   = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { signInWithGoogle, signInWithEmail, resetPassword, isDemo } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try { await signInWithGoogle(); analytics.login('google'); navigate('/dashboard'); }
    catch { setError('Google sign-in failed. Try again.'); }
    finally { setLoading(false); }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await signInWithEmail(email, password); analytics.login('email'); navigate('/dashboard'); }
    catch (err) {
      setError(err?.code === 'auth/invalid-credential' ? 'Invalid email or password.' : 'Sign-in failed. Try again.');
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetSent(true);
    } catch {
      setResetSent(true); // Don't reveal if email exists
    } finally { setResetLoading(false); }
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,300&display=swap');
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { border-color: rgba(0,212,170,0.4) !important; }
      `}</style>
      <div style={s.box}>
        <div style={s.logo}>W</div>
        <div style={s.headline}>Plan your next<br /><em style={{ fontWeight: 300, color: 'rgba(255,255,255,0.45)' }}>slow journey</em></div>
        <div style={s.sub}>Sign in to access your trips and recommendations</div>

        {isDemo && <div style={s.demo}>✦ Demo mode — sign in with any credentials</div>}
        {error && <div style={s.error}>{error}</div>}

        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon /> Continue with Google
        </button>

        <div style={s.divider}>
          <div style={s.divLine} /><span style={s.divText}>or</span><div style={s.divLine} />
        </div>

        <form onSubmit={handleEmail}>
          <input style={s.input} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>{loading ? '…' : 'Sign in →'}</button>
        </form>

        <div style={s.footer}>
          <Link to="/signup" style={s.link}>No account? Sign up</Link>
          {' · '}
          <span style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', textDecoration: 'underline', textUnderlineOffset: 2 }} onClick={() => { setShowReset(!showReset); setResetSent(false); }}>
            Forgot password?
          </span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Privacy Policy</Link>
          {' · '}
          <Link to="/terms" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Terms</Link>
        </div>

        {/* Inline password reset */}
        {showReset && (
          <div style={s.resetBox}>
            <div style={s.resetTitle}>Reset your password</div>
            {resetSent ? (
              <div style={s.success}>
                ✓ If an account exists for that email, a reset link has been sent. Check your inbox.
              </div>
            ) : (
              <form onSubmit={handleReset}>
                <input
                  style={{ ...s.input, marginBottom: 10 }}
                  type="email"
                  placeholder="Enter your email address"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                />
                <button style={s.resetBtn} type="submit" disabled={resetLoading}>
                  {resetLoading ? '…' : 'Send reset link →'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
