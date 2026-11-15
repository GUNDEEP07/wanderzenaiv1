import { Link } from 'react-router-dom';
import SiteHeader from '../../components/SiteHeader';
import { CreditedPhoto } from '../../components/PhotoCredit';
import Seo from '../../seo/Seo';
import { SITE_URL } from '../../seo/site';
import { GUIDES, guidePath } from './guidesData';
import { daysSpan, routeLine } from './guideText';
import './guides.css';

const s = {
  page: { minHeight: '100vh', background: '#06090f', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  wrap: { maxWidth: 1100, margin: '0 auto', padding: 'clamp(28px,5vw,56px) clamp(16px,4vw,32px) 64px' },
  eyebrow: { color: '#00d4aa', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem,5vw,3.25rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 14px' },
  lead: { fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)', maxWidth: 680, margin: '0 0 36px' },
  name: { fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, margin: '0 0 4px' },
  meta: { fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' },
  line: { fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, margin: 0 },
};

export default function GuidesIndex() {
  return (
    <div style={s.page}>
      <Seo
        title="Slow travel itineraries by country"
        description="Hand-picked slow travel routes for Vietnam, Japan, India, Italy, Portugal, New Zealand and more: fewer stops, longer stays, short transfers and day trips worth taking."
        path="/guides"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Slow travel itineraries by country',
          url: `${SITE_URL}/guides`,
          hasPart: GUIDES.map((g) => ({ '@type': 'WebPage', name: `${g.name} slow travel itinerary`, url: `${SITE_URL}${guidePath(g)}` })),
        }}
      />
      <SiteHeader />
      <main style={s.wrap}>
        <div style={s.eyebrow}>Guides</div>
        <h1 style={s.h1}>Slow travel itineraries by country</h1>
        <p style={s.lead}>
          Each guide holds a few hand-picked routes: fewer stops, two to four days in each place,
          short transfers and the day trips worth taking. Pick one as it is, or open it in the
          planner and shape it to your dates, pace and who's coming.
        </p>
        <div className="guides-grid">
          {GUIDES.map((g) => (
            <Link key={g.slug} to={guidePath(g)} className="guide-card">
              <CreditedPhoto keyword={g.name} size="card" alt="" corner="bottom-right" style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
              <div className="guide-card__body">
                <h2 style={s.name}>{g.name}</h2>
                <p style={s.meta}>{g.routes.length} routes · {daysSpan(g.routes)}</p>
                <p style={s.line}>{routeLine(g.routes[0].stops)}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
