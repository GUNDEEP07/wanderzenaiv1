import { lazy, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import SiteHeader from '../../components/SiteHeader';
import { CreditedPhoto } from '../../components/PhotoCredit';
import Seo from '../../seo/Seo';
import { SITE_URL } from '../../seo/site';
import NotFound from '../NotFound';
import { GUIDES, guideBySlug, guidePath, planPrefill } from './guidesData';
import { formatHours, modeLabel, dayRanges, dayLabel, daysSpan, routeLine, countWord } from './guideText';
import './guides.css';

const RouteMap = lazy(() => import('../../components/map/RouteMap'));

const s = {
  page: { minHeight: '100vh', background: '#06090f', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  wrap: { maxWidth: 1100, margin: '0 auto', padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,32px) 72px' },
  crumbs: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 18 },
  crumbLink: { color: 'rgba(255,255,255,0.75)', textDecoration: 'none' },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.9rem,4.6vw,3rem)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 14px' },
  lead: { fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.75)', maxWidth: 720, margin: '0 0 22px' },
  hero: { width: '100%', height: 'clamp(200px,38vw,380px)', objectFit: 'cover', borderRadius: 18, display: 'block' },
  h2: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.5rem,3.4vw,2.1rem)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 8px' },
  summary: { fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)', margin: '0 0 14px', maxWidth: 640 },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 22px' },
  badge: (accent) => ({ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: accent ? 'rgba(0,212,170,0.14)' : 'rgba(255,255,255,0.06)', color: accent ? '#00d4aa' : 'rgba(255,255,255,0.78)', border: `1px solid ${accent ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.1)'}` }),
  stopDays: { fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 2 },
  h3: { fontSize: 19, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' },
  region: { fontWeight: 500, color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  p: { fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)', margin: '0 0 8px' },
  dl: { fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' },
  label: { color: 'rgba(255,255,255,0.5)', fontWeight: 700 },
  cta: { display: 'inline-flex', alignItems: 'center', minHeight: 46, padding: '0 20px', borderRadius: 12, background: '#00d4aa', color: '#06090f', fontWeight: 800, fontSize: 15, textDecoration: 'none', marginTop: 4 },
  mapFallback: { height: 300, borderRadius: 14, background: '#0d1420', border: '1px solid rgba(255,255,255,0.08)' },
  others: { borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 48, paddingTop: 28 },
  note: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 28, lineHeight: 1.6 },
};

export default function GuidePage() {
  const { country } = useParams();
  const guide = guideBySlug(country);
  if (!guide) {
    return (
      <>
        <Seo title="Guide not found" noindex />
        <NotFound />
      </>
    );
  }

  const path = guidePath(guide);
  const span = daysSpan(guide.routes);
  const title = `${guide.name} slow travel itinerary: ${countWord(guide.routes.length)} routes for ${span}`;
  const description = `${countWord(guide.routes.length)[0].toUpperCase()}${countWord(guide.routes.length).slice(1)} hand-picked slow routes through ${guide.name} (${span}): ${guide.routes.map((r) => routeLine(r.stops)).join('; ')}. Where to stay, how to get between stops and the day trips worth taking.`;

  return (
    <div style={s.page}>
      <Seo
        title={title}
        description={description}
        path={path}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Guides', item: `${SITE_URL}/guides` },
              { '@type': 'ListItem', position: 2, name: guide.name, item: `${SITE_URL}${path}` },
            ],
          },
          ...guide.routes.map((r) => ({
            '@context': 'https://schema.org',
            '@type': 'TouristTrip',
            name: `${guide.name}: ${r.name} (${r.days} days)`,
            description: r.bestLabel ? `${r.summary} Best time: ${r.bestLabel}.` : r.summary,
            url: `${SITE_URL}${path}#${r.id}`,
            touristType: r.kidFriendly ? ['Slow travellers', 'Families'] : ['Slow travellers'],
            itinerary: {
              '@type': 'ItemList',
              itemListElement: r.stops.map((st, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                item: { '@type': 'Place', name: `${st.name}, ${guide.name}`, geo: { '@type': 'GeoCoordinates', latitude: st.lat, longitude: st.lng } },
              })),
            },
          })),
        ]}
      />
      <SiteHeader />
      <main style={s.wrap}>
        <nav aria-label="Breadcrumb" style={s.crumbs}>
          <Link to="/guides" style={s.crumbLink}>Guides</Link> <span aria-hidden="true">›</span> {guide.name}
        </nav>
        <h1 style={s.h1}>{title}</h1>
        <p style={s.lead}>
          Fewer stops, longer stays. These {countWord(guide.routes.length)} routes through {guide.name} keep
          transfers short and leave whole days for walking, cafés and the day trips worth taking. Each one
          is a starting point: open it in the planner and it adjusts to your dates, pace and who's travelling.
        </p>
        <div className="guide-jump" style={{ marginBottom: 26 }}>
          {guide.routes.map((r) => <a key={r.id} href={`#${r.id}`}>{r.name} · {r.days} days</a>)}
        </div>
        <CreditedPhoto keyword={guide.name} size="hero" alt={`${guide.name} landscape`} loading="eager" corner="bottom-right" style={s.hero} />

        {guide.routes.map((r) => {
          const ranges = dayRanges(r.stops);
          return (
            <section key={r.id} id={r.id} className="guide-route" aria-labelledby={`${r.id}-title`}>
              <h2 id={`${r.id}-title`} style={s.h2}>{r.name}: {r.days} days</h2>
              <p style={s.summary}>{r.summary}</p>
              {r.seasonNote && <p style={{ ...s.summary, fontSize: '0.9rem', opacity: 0.85 }}>When to go: {r.seasonNote}.</p>}
              <div style={s.badges}>
                <span style={s.badge(true)}>{routeLine(r.stops)}</span>
                {r.kidFriendly && <span style={s.badge(false)}>Good with kids</span>}
                {r.longestTransferHours > 0 && <span style={s.badge(false)}>Longest transfer ~{formatHours(r.longestTransferHours)}</span>}
                {r.bestLabel && <span style={s.badge(false)} title={r.seasonNote}>Best {r.bestLabel}</span>}
              </div>
              <div className="guide-route__layout">
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {r.stops.map((st, i) => (
                    <li key={`${st.name}-${i}`} className="guide-stop">
                      <span className="guide-stop__dot" aria-hidden="true">{i + 1}</span>
                      <div style={s.stopDays}>{dayLabel(ranges[i])}</div>
                      <h3 style={s.h3}>{st.name} <span style={s.region}>{st.region && st.region !== st.name ? `· ${st.region}` : ''}</span></h3>
                      <p style={s.p}>{st.why}</p>
                      <p style={s.dl}><span style={s.label}>Stay: </span>{st.stayType}</p>
                      {st.transferIn && (
                        <p style={s.dl}>
                          <span style={s.label}>Getting there: </span>
                          {modeLabel(st.transferIn.mode)}, about {formatHours(st.transferIn.hours)}{st.transferIn.note ? `. ${st.transferIn.note}` : ''}
                        </p>
                      )}
                      {st.dayTrips.length > 0 && <p style={s.dl}><span style={s.label}>Day trips: </span>{st.dayTrips.join(' · ')}</p>}
                    </li>
                  ))}
                </ol>
                <div className="guide-route__map">
                  <Suspense fallback={<div style={s.mapFallback} />}>
                    <RouteMap stops={r.stops} height={300} label={`Map of the ${r.name} route`} />
                  </Suspense>
                  <Link to="/plan" state={planPrefill(guide, r)} style={{ ...s.cta, marginTop: 14 }}>
                    Plan this route
                  </Link>
                </div>
              </div>
            </section>
          );
        })}

        <p style={s.note}>
          Travel times are door to door for the way a slow traveller would usually go, and change with
          season and traffic. Check transport and opening times before you book.
        </p>

        <div style={s.others}>
          <h2 style={{ ...s.h2, fontSize: 20 }}>More slow travel guides</h2>
          <div className="guide-others">
            {GUIDES.filter((g) => g.slug !== guide.slug).map((g) => <Link key={g.slug} to={guidePath(g)}>{g.name}</Link>)}
          </div>
        </div>
      </main>
    </div>
  );
}
