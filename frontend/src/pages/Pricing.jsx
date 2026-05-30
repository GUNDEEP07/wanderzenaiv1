import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SINGLE_LINK = import.meta.env.VITE_STRIPE_SINGLE_PLAN_LINK;
const WANDERER_LINK = import.meta.env.VITE_STRIPE_WANDERER_LINK;

const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '1.25rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(20px)' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' },
  logoMark: { width: 28, height: 28, borderRadius: 7, background: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0a0f1e' },
  inner: { maxWidth: 1100, margin: '0 auto', padding: '5rem 1.5rem 6rem' },
  notice: { background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '2.5rem', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  header: { textAlign: 'center', marginBottom: '4rem' },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '1.25rem', padding: '6px 16px', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 100, background: 'rgba(0,212,170,0.08)' },
  title: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' },
  sub: { fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 520, margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '5rem', alignItems: 'start' },
  card: (featured) => ({
    background: featured ? 'linear-gradient(135deg, #141d33 0%, rgba(0,212,170,0.06) 100%)' : '#111827',
    border: `1px solid ${featured ? '#00d4aa' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 20, padding: '2.5rem',
    position: 'relative', overflow: 'hidden',
    transition: 'all 0.3s',
  }),
  cardTop: (featured) => ({
    content: '', position: 'absolute',
    top: 0, left: 0, right: 0, height: 2,
    background: featured ? 'linear-gradient(90deg, transparent, #00d4aa, transparent)' : 'transparent',
  }),
  badge: { position: 'absolute', top: -1, right: 24, background: '#00d4aa', color: '#0a0f1e', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: '0 0 8px 8px' },
  planName: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '1rem' },
  price: { fontFamily: "'Fraunces', serif", fontSize: '3.5rem', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '0.25rem' },
  priceSub: { fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.4)' },
  period: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginBottom: '2rem', marginTop: '0.25rem' },
  features: { listStyle: 'none', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  featureItem: { fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'flex-start', gap: 10 },
  check: { color: '#00d4aa', flexShrink: 0, fontWeight: 700, marginTop: 1 },
  btnOutline: { width: '100%', padding: '0.9rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: '-0.01em' },
  btnFilled: { width: '100%', padding: '0.9rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: '#00d4aa', color: '#0a0f1e', border: 'none', letterSpacing: '-0.01em' },
  faqSection: { maxWidth: 800, margin: '0 auto 4rem' },
  faqTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: '2.5rem', letterSpacing: '-0.02em' },
  faqGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' },
  faqItem: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem', cursor: 'pointer', transition: 'border-color 0.2s' },
  faqQ: { fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqA: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 },
  footer: { textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)' },
  footerLink: { color: '#00d4aa', textDecoration: 'none' },
};

const PLANS = [
  {
    name: 'Explorer',
    price: 'Free',
    period: '1 itinerary per month',
    desc: 'Perfect for occasional travellers',
    features: ['Full day-by-day itinerary', 'Hidden gems every day', 'Local food picks & insider tips', 'PDF download & email delivery', 'Any destination worldwide'],
    cta: 'Get started free',
    link: null,
    featured: false,
  },
  {
    name: 'Wanderer',
    price: '$9',
    period: 'per month · cancel anytime',
    desc: 'For passionate slow travellers',
    features: ['Everything in Free', '5 itineraries per month', 'Longer & more detailed plans', 'Priority generation', 'Accommodation deep-dives', 'Multi-language itineraries'],
    cta: 'Start Wanderer',
    link: WANDERER_LINK,
    featured: true,
  },
  {
    name: 'Single Plan',
    price: '$7',
    period: 'one-time · no subscription',
    desc: 'Just one trip, no commitment',
    features: ['Everything in Free', '1 premium itinerary', 'Pay once, keep forever', 'No recurring charges'],
    cta: 'Buy one plan',
    link: SINGLE_LINK,
    featured: false,
  },
];

const FAQS = [
  { q: 'How long does it take?', a: 'Your itinerary is generated and emailed within 2–3 minutes of submitting the form. No waiting around.' },
  { q: 'What format is the itinerary?', a: 'A beautifully designed PDF — print-ready with day cards, hidden gems, local food picks and cost breakdown.' },
  { q: 'Can I request any destination?', a: 'Yes — any city, region or country worldwide. The more specific your interests, the better the plan.' },
  { q: 'What makes this different?', a: 'We avoid tourist traps by design. Every plan includes hidden gems, local eats and off-the-beaten-path stays that most guides never mention.' },
  { q: 'Can I get my itinerary in another language?', a: 'Yes — choose from English, Hindi, Spanish, French, German, Japanese, Arabic, Portuguese, Italian and Dutch.' },
  { q: 'Can I cancel my subscription?', a: 'Yes, anytime. No questions asked. All itineraries you have already generated are yours to keep.' },
  { q: 'Do you store my payment details?', a: 'No — payments are handled entirely by Stripe. We never see or store your card details.' },
  { q: 'What if my itinerary fails?', a: 'Rare, but if it happens we regenerate it for free. Email travel@wanderzenai.com and we will sort it within the hour.' },
];

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = location.state?.reason;
  const [openFaq, setOpenFaq] = useState(null);

  const handleCta = (plan) => {
    if (!plan.link) { navigate('/plan'); return; }
    window.location.href = plan.link;
  };

  return (
    <div style={{...s.page, margin: 0, padding: 0, minHeight: '100vh', background: '#0a0f1e'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&display=swap');
        * { box-sizing: border-box; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 24px 48px rgba(0,0,0,0.4); }
        .faq-item:hover { border-color: rgba(0,212,170,0.25) !important; }
        .btn-outline:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.05) !important; }
        .btn-filled:hover { background: #fff !important; transform: translateY(-1px); }
      `}</style>

      <nav style={s.nav}>
        <button style={s.backBtn} onClick={() => navigate('/')}>
          <div style={s.logoMark}>W</div>
          WanderZenAI
        </button>
      </nav>

      <div style={s.inner}>
        {reason === 'free_limit' && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,168,126,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 40,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', fontSize: 64, color: 'rgba(0,212,170,0.06)', pointerEvents: 'none' }}>✦</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 8 }}>
              Free plan limit reached
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
              {location.state?.destination
                ? <>Your {location.state.destination} itinerary is waiting</>
                : <>Your itinerary is ready to be built</>}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 18, lineHeight: 1.6 }}>
              You've used your free itinerary this month.
              Upgrade to unlock unlimited trips — your {location.state?.destination || 'next destination'} itinerary will generate immediately after.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Unlimited itineraries', 'Priority generation', 'All destinations', 'Keep all PDFs'].map(f => (
                <span key={f} style={{ padding: '5px 12px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#00d4aa' }}>
                  ✓ {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={s.header}>
          <div style={s.eyebrow}>Pricing</div>
          <h1 style={s.title}>Simple, honest pricing.</h1>
          <p style={s.sub}>No hidden fees. No tourist-trap pricing. Your PDF is yours to keep forever.</p>
        </div>

        <div style={s.grid}>
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="plan-card"
              style={s.card(plan.featured)}
            >
              {plan.featured && (
                <>
                  <div style={s.cardTop(true)} />
                  <div style={s.badge}>Most popular</div>
                </>
              )}
              <div style={s.planName}>{plan.name}</div>
              <div style={s.price}>
                {plan.price}
                {plan.price !== 'Free' && <span style={s.priceSub}></span>}
              </div>
              <div style={s.period}>{plan.period}</div>
              <ul style={s.features}>
                {plan.features.map(f => (
                  <li key={f} style={s.featureItem}>
                    <span style={s.check}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                className={plan.featured ? 'btn-filled' : 'btn-outline'}
                style={plan.featured ? s.btnFilled : s.btnOutline}
                onClick={() => handleCta(plan)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div style={s.faqSection}>
          <h2 style={s.faqTitle}>Common questions</h2>
          <div style={s.faqGrid}>
            {FAQS.map((faq, i) => (
              <div
                key={faq.q}
                className="faq-item"
                style={s.faqItem}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={s.faqQ}>
                  <span>{faq.q}</span>
                  <span style={{ color: '#00d4aa', fontSize: '1.1rem', flexShrink: 0 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </div>
                {openFaq === i && <div style={s.faqA}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={s.footer}>
          <p>Questions? Email <a href="mailto:travel@wanderzenai.com" style={s.footerLink}>travel@wanderzenai.com</a></p>
          <p style={{ marginTop: '0.5rem' }}>
            <a href="/privacy" style={{ ...s.footerLink, color: 'rgba(255,255,255,0.3)', marginRight: '1.5rem' }}>Privacy</a>
            <a href="/terms" style={{ ...s.footerLink, color: 'rgba(255,255,255,0.3)' }}>Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}
