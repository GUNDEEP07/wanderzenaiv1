import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff', textAlign: 'center', padding: 24 }}>
      <style>{``}</style>
      <div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 96, fontWeight: 900, color: 'rgba(255,255,255,0.06)', lineHeight: 1, marginBottom: 4 }}>404</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, marginBottom: 10 }}>Page not found</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 36, fontStyle: 'italic' }}>This destination doesn't exist on our map</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            Go home
          </button>
          <button onClick={() => navigate(-1)} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
