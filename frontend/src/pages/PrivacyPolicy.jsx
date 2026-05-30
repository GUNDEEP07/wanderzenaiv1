import { useNavigate } from 'react-router-dom';

const s = {
  page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '14px 36px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 },
  back: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  inner: { maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 900, marginBottom: 8 },
  updated: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 40 },
  h2: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 36, marginBottom: 12 },
  p: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, marginBottom: 14 },
  li: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, marginBottom: 6, marginLeft: 20 },
};

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&family=Fraunces:opsz,wght@9..144,700;9..144,900&display=swap');`}</style>
      <nav style={s.nav}>
        <button style={s.back} onClick={() => navigate(-1)}>← Back</button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Privacy Policy</span>
      </nav>
      <div style={s.inner}>
        <h1 style={s.h1}>Privacy Policy</h1>
        <p style={s.updated}>Last updated: 31 May 2026</p>

        <p style={s.p}>WanderZenAI ("we", "us", "our") is committed to protecting your personal information. This policy explains what data we collect, how we use it, and your rights.</p>

        <h2 style={s.h2}>1. Information we collect</h2>
        <p style={s.p}>When you use WanderZenAI we may collect:</p>
        <ul>
          <li style={s.li}><strong>Account data:</strong> name, email address, age, gender, home city, WhatsApp number (optional)</li>
          <li style={s.li}><strong>Travel data:</strong> destinations searched, itineraries generated, travel style preferences</li>
          <li style={s.li}><strong>Payment data:</strong> billing handled by Stripe — we never store card details</li>
          <li style={s.li}><strong>Usage data:</strong> pages visited, features used, device and browser information</li>
        </ul>

        <h2 style={s.h2}>2. How we use your information</h2>
        <ul>
          <li style={s.li}>Generate personalised travel itineraries using AI</li>
          <li style={s.li}>Send your itinerary PDF via email</li>
          <li style={s.li}>Provide personalised destination recommendations</li>
          <li style={s.li}>Process payments and manage your subscription</li>
          <li style={s.li}>Improve our service and fix issues</li>
        </ul>

        <h2 style={s.h2}>3. Data sharing</h2>
        <p style={s.p}>We do not sell your personal data. We share data only with service providers that help us operate:</p>
        <ul>
          <li style={s.li}><strong>Anthropic (Claude):</strong> AI itinerary generation — your trip details are sent to generate content</li>
          <li style={s.li}><strong>AWS:</strong> Hosting, storage, and email delivery</li>
          <li style={s.li}><strong>Stripe:</strong> Payment processing</li>
          <li style={s.li}><strong>Firebase (Google):</strong> Authentication</li>
          <li style={s.li}><strong>Foursquare:</strong> Venue recommendations</li>
        </ul>

        <h2 style={s.h2}>4. Data retention</h2>
        <p style={s.p}>We retain your account data while your account is active. Itinerary PDFs are stored for 90 days (free plan) or 365 days (paid plan) then automatically deleted. You may request deletion at any time.</p>

        <h2 style={s.h2}>5. Your rights</h2>
        <p style={s.p}>You have the right to access, correct, or delete your personal data at any time. You can manage most data from your Settings page. For other requests, email us at <a href="mailto:travel@wanderzenai.com" style={{ color: '#00d4aa' }}>travel@wanderzenai.com</a>.</p>

        <h2 style={s.h2}>6. Cookies</h2>
        <p style={s.p}>We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. You can disable cookies in your browser settings, but this may affect functionality.</p>

        <h2 style={s.h2}>7. Security</h2>
        <p style={s.p}>We use industry-standard security measures including HTTPS encryption, AWS security controls, and Firebase Authentication. No method of transmission is 100% secure — we cannot guarantee absolute security.</p>

        <h2 style={s.h2}>8. Contact</h2>
        <p style={s.p}>For privacy questions: <a href="mailto:travel@wanderzenai.com" style={{ color: '#00d4aa' }}>travel@wanderzenai.com</a></p>
      </div>
    </div>
  );
}
