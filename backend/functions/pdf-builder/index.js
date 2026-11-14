'use strict';

// @sparticuz/chromium (≥133) and puppeteer-core (≥24) are ES modules. Load them with dynamic
// import(): Lambda's nodejs24.x runtime does NOT allow require() of ES modules (it crashed at
// start-up with ERR_REQUIRE_ESM on Nov 14 2026 even though plain Node 24 allows it).
let browserLibs = null;
async function loadBrowserLibs() {
  if (!browserLibs) {
    const [chromiumModule, puppeteerModule] = await Promise.all([import('@sparticuz/chromium'), import('puppeteer-core')]);
    const chromium = chromiumModule.default;
    // PDFs need no GPU; skip unpacking SwiftShader (smaller /tmp, faster cold start).
    chromium.setGraphicsMode = false;
    browserLibs = { chromium, puppeteer: puppeteerModule.default };
  }
  return browserLibs;
}

/** Edge-to-edge pages: plain PDF margins print white, which breaks the dark design. */
const PDF_PAGE_OPTIONS = { margin: { top: '0', right: '0', bottom: '0', left: '0' } };

/** A4-ish viewport; page.pdf() sets the paper size itself. */
const PDF_VIEWPORT = { width: 1240, height: 1754, deviceScaleFactor: 1, isMobile: false, hasTouch: false, isLandscape: false };

/**
 * Start Chromium the way @sparticuz/chromium documents for v153 on Lambda
 * (headless "shell"). Exported for the Node 24 render test.
 */
async function launchBrowser() {
  const { chromium, puppeteer } = await loadBrowserLibs();
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    defaultViewport: PDF_VIEWPORT,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
}
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, getCurrencySymbol, log } = require('/opt/nodejs/index');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

// ─── Text helpers ─────────────────────────────────────────────────────────────

const { richText, plainText, escapeHtml } = require('./rich-text');

// Claude text (activity notes, tips, hidden gems) → safe HTML; markdown map links become a small pin.
const sanitize = (text) => richText(text);

// Google Maps search URL for a place: its name first, then the area/country to disambiguate.
// (The old version dropped the name whenever an area was given, so every activity pointed at the country.)
const mapsUrl = (name, area, country) => {
  const parts = [name, area, country].map(p => String(p || '').trim()).filter(Boolean);
  const seen = new Set();
  const query = parts.filter(p => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).join(', ') || 'map';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const formatMoney = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US') : null;
};

// ─── Social media links ───────────────────────────────────────────────────────

const socialLinks = (social) => {
  if (!social) return '';
  const links = [];
  if (social.instagram) links.push(`<a href="https://instagram.com/${escapeHtml(social.instagram)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">📷 @${escapeHtml(social.instagram)}</a>`);
  if (social.twitter) links.push(`<a href="https://twitter.com/${escapeHtml(social.twitter)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">𝕏 @${escapeHtml(social.twitter)}</a>`);
  if (social.facebook_id) links.push(`<a href="https://facebook.com/${escapeHtml(social.facebook_id)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🌐 Facebook</a>`);
  return links.length ? `<div style="display:flex;gap:8px;margin-top:3px;flex-wrap:wrap">${links.join('')}</div>` : '';
};

// ─── Venue card ───────────────────────────────────────────────────────────────
// Renders a structured card for a verified Foursquare venue
// Shows: name, category, address, map link, Foursquare link, phone, website, social

const venueCard = (venue) => {
  if (!venue || !venue.name) return '';
  const mapLink = venue.mapsUrl || mapsUrl(venue.name, venue.area, venue.country);
  const fsqLink = venue.foursquareUrl || null;
  const verified = venue.fsqPlaceId
    ? `<span style="font-size:7px;padding:1px 6px;background:rgba(0,212,170,0.1);border:1px solid rgba(0,212,170,0.3);border-radius:10px;color:var(--teal);font-weight:700">✓ Verified</span>`
    : '';
  const category = venue.category
    ? `<span style="font-size:7px;padding:1px 6px;border:1px solid rgba(0,212,170,0.3);border-radius:10px;color:var(--teal);font-weight:600">${escapeHtml(venue.category)}</span>`
    : '';

  return `
  <div style="display:flex;gap:3mm;align-items:flex-start;background:rgba(0,212,170,0.04);border:1px solid rgba(0,212,170,0.12);border-radius:8px;padding:3mm 4mm;margin-top:2mm">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:#fff">${escapeHtml(venue.name)}</span>
        ${category}${verified}
      </div>
      ${venue.address ? `<div style="font-size:8px;color:rgba(255,255,255,0.4);margin-bottom:3px">${escapeHtml(venue.address)}</div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <a href="${escapeHtml(mapLink)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">📍 Google Maps</a>
        ${fsqLink ? `<a href="${escapeHtml(fsqLink)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🔍 Foursquare</a>` : ''}
        ${venue.tel ? `<span style="color:rgba(255,255,255,0.4);font-size:8px">📞 ${escapeHtml(venue.tel)}</span>` : ''}
        ${venue.website && /^https?:\/\//i.test(venue.website) ? `<a href="${escapeHtml(venue.website)}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🌐 Website</a>` : ''}
      </div>
      ${socialLinks(venue.social || venue.social_media)}
    </div>
  </div>`;
};

// ─── HTML template ────────────────────────────────────────────────────────────

const buildHTML = (itinerary, submission, currencySymbol, heroImageUrl = null) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;1,9..144,300;1,9..144,400&family=Noto+Sans:wght@400;600&family=Noto+Sans+JP:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Arabic:wght@400;600&display=swap');

:root {
  --navy:    #0a0f1e;
  --navy-2:  #111827;
  --navy-3:  #141d33;
  --teal:    #00d4aa;
  --teal-bg: rgba(0,212,170,0.08);
  --teal-br: rgba(0,212,170,0.2);
  --coral:   #ff6b6b;
  --gold:    #ffd93d;
  --white:   #ffffff;
  --w90:     rgba(255,255,255,0.9);
  --w60:     rgba(255,255,255,0.6);
  --w30:     rgba(255,255,255,0.3);
  --border:  rgba(255,255,255,0.08);
}

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: 'Plus Jakarta Sans','Noto Sans','Noto Sans JP','Noto Sans Devanagari','Noto Sans Arabic',sans-serif;
  background:var(--navy); color:var(--white); font-size:11px; line-height:1.7;
  -webkit-font-smoothing:antialiased; overflow-wrap:anywhere;
}
a { color:var(--teal); text-decoration:none; }
.map-pin { display:inline-block; white-space:nowrap; font-size:8px; font-weight:700; font-style:normal; color:var(--teal); padding:0 5px; border:1px solid rgba(0,212,170,0.35); border-radius:4px; line-height:1.5; vertical-align:1px; }
.text-link { color:var(--teal); font-weight:600; }

.page { width:210mm; min-height:297mm; padding:14mm 16mm; background:var(--navy); }

.header { display:flex; align-items:flex-start; justify-content:space-between; gap:8mm; padding-bottom:4mm; }
.logo-area { display:flex; align-items:center; gap:8px; }
.logo-mark { width:32px; height:32px; border-radius:8px; background:var(--teal); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:var(--navy); flex-shrink:0; }
.logo-text { font-size:16px; font-weight:700; color:var(--white); letter-spacing:-0.02em; }
.logo-text span { color:var(--teal); }
.logo-sub { font-size:8px; color:var(--w60); letter-spacing:0.12em; text-transform:uppercase; margin-top:1px; white-space:nowrap; }
.logo-area { flex-shrink:0; }
.header-right { flex:1; min-width:0; text-align:right; }
.trip-title { font-family:'Fraunces',serif; font-size:20px; font-weight:700; color:var(--white); line-height:1.2; letter-spacing:-0.02em; }
.trip-summary { font-size:10.5px; color:rgba(255,255,255,0.75); line-height:1.65; padding-bottom:5mm; border-bottom:1px solid var(--border); margin-bottom:6mm; }

.hero { width:100%; height:52mm; border-radius:10px; overflow:hidden; margin-bottom:6mm; position:relative; }
.hero img { width:100%; height:100%; object-fit:cover; display:block; }
.hero-overlay { position:absolute; bottom:0; left:0; right:0; height:20mm; background:linear-gradient(transparent,rgba(10,15,30,0.85)); }

.meta-bar { display:flex; background:var(--navy-3); border:1px solid var(--border); border-radius:10px; margin-bottom:6mm; overflow:hidden; }
.meta-item { flex:1; padding:3.5mm 4mm; text-align:center; border-right:1px solid var(--border); }
.meta-item:last-child { border-right:none; }
.meta-label { font-size:7px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--teal); margin-bottom:2px; }
.meta-value { font-family:'Fraunces',serif; font-size:13px; font-weight:700; color:var(--white); letter-spacing:-0.02em; }

.accom-box { background:var(--teal-bg); border:1px solid var(--teal-br); border-radius:10px; padding:4mm 5mm; margin-bottom:5mm; }
.accom-header { display:flex; align-items:center; gap:6px; margin-bottom:2mm; }
.accom-dot { width:6px; height:6px; border-radius:50%; background:var(--teal); }
.accom-title { font-size:7px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--teal); }
.accom-rec { font-size:10px; font-weight:700; color:var(--white); margin-bottom:1.5mm; }
.accom-why { font-size:9.5px; color:rgba(255,255,255,0.7); font-style:italic; line-height:1.6; }
.search-label { font-size:7px; color:var(--w30); letter-spacing:0.1em; text-transform:uppercase; margin-top:3mm; margin-bottom:2mm; font-weight:600; }
.search-pills { display:flex; flex-wrap:wrap; gap:4px; }
.search-pill { font-size:8px; padding:2px 8px; border:1px solid var(--teal-br); border-radius:100px; color:var(--teal); background:rgba(0,212,170,0.05); font-weight:600; }

.day-card { background:var(--navy-2); border:1px solid var(--border); border-radius:10px; margin-bottom:4mm; }
/* Keep each block whole, but let a day run across pages instead of leaving half a page empty. */
.day-header { break-after:avoid; border-radius:10px 10px 0 0; }
.activity, .local-eats, .hidden-gem, .tip-item, .avoid-item, .accom-box { break-inside:avoid; }
.day-header { background:var(--navy-3); padding:3.5mm 5mm; display:flex; align-items:center; gap:4mm; border-bottom:1px solid var(--border); }
.day-num { font-family:'Fraunces',serif; font-size:26px; font-weight:700; color:var(--teal); line-height:1; letter-spacing:-0.03em; flex-shrink:0; }
.day-info { flex:1; }
.day-theme { font-size:12px; font-weight:700; color:var(--white); letter-spacing:-0.01em; line-height:1.2; }
.day-budget { font-size:9px; color:var(--w60); margin-top:2px; }
.day-body { padding:4mm 5mm; }

.activity { padding-bottom:3.5mm; margin-bottom:3.5mm; border-bottom:1px solid var(--border); }
.activity:last-of-type { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.activity-header { display:flex; align-items:center; gap:3mm; margin-bottom:1.5mm; }
.activity-time { font-size:8px; font-weight:700; color:var(--teal); letter-spacing:0.05em; min-width:18mm; }
.activity-period { font-size:7.5px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--w60); }
.activity-cost { margin-left:auto; font-size:8px; font-weight:700; color:var(--navy); background:var(--teal); padding:1.5px 6px; border-radius:4px; }
.activity-cost.free { background:rgba(0,212,170,0.15); color:var(--teal); }
.activity-name { font-size:11px; font-weight:700; color:var(--white); margin-bottom:1mm; letter-spacing:-0.01em; line-height:1.3; }
.activity-location { display:flex; align-items:center; flex-wrap:wrap; gap:2mm 3mm; font-size:9.5px; color:var(--teal); font-weight:600; margin-bottom:1.5mm; line-height:1.4; }
.activity-map { display:inline-block; white-space:nowrap; font-size:8px; color:var(--teal); text-decoration:none; font-weight:700; padding:1px 6px; border:1px solid rgba(0,212,170,0.35); border-radius:4px; }
.activity-why { font-size:10px; color:rgba(255,255,255,0.75); line-height:1.6; margin-bottom:1.5mm; }
.insider-tip { background:rgba(255,217,61,0.06); border-left:2px solid var(--gold); padding:2mm 3mm; font-size:9.5px; color:rgba(255,217,61,0.9); line-height:1.55; border-radius:0 4px 4px 0; }
.insider-tip strong { font-style:normal; font-weight:700; }

.local-eats { background:rgba(255,107,107,0.06); border:1px solid rgba(255,107,107,0.15); border-radius:8px; padding:3mm 4mm; margin-top:3mm; display:flex; gap:3mm; align-items:flex-start; }
.eats-icon { width:24px; height:24px; border-radius:6px; background:rgba(255,107,107,0.15); display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; }
.eats-name { font-size:10px; font-weight:700; color:var(--white); margin-bottom:1px; }
.eats-dish { font-size:9.5px; color:rgba(255,107,107,0.8); margin-bottom:1px; }
.eats-vibe { font-size:9px; color:rgba(255,255,255,0.7); font-style:italic; }

.hidden-gem { background:linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,212,170,0.04)); border:1px solid var(--teal-br); border-radius:8px; padding:3mm 4mm; margin-top:3mm; }
.gem-label { font-size:7px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--teal); margin-bottom:1.5mm; display:flex; align-items:center; gap:5px; }
.gem-label::before { content:''; display:inline-block; width:12px; height:1px; background:var(--teal); }
.gem-text { font-size:10px; color:var(--w90); line-height:1.6; font-style:italic; }

.tips-grid { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-top:5mm; align-items:start; }
.tips-section { background:var(--navy-2); border:1px solid var(--border); border-radius:10px; padding:4mm 5mm; break-inside:avoid; }
.section-heading { font-size:7px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--teal); margin-bottom:3mm; display:flex; align-items:center; gap:8px; }
.section-heading::after { content:''; flex:1; height:1px; background:var(--border); }
.tip-item span:last-child, .avoid-item span:last-child { flex:1; min-width:0; }
.tip-item { display:flex; gap:3mm; margin-bottom:2mm; font-size:10px; line-height:1.6; color:rgba(255,255,255,0.75); }
.tip-arrow { width:5px; height:5px; border-radius:50%; background:var(--teal); flex-shrink:0; margin-top:6px; }
.avoid-item { display:flex; gap:3mm; margin-bottom:2mm; font-size:10px; line-height:1.6; color:rgba(255,160,160,0.9); }
.avoid-x { width:7px; height:2px; background:var(--coral); flex-shrink:0; margin-top:8px; }

.pdf-footer { margin-top:6mm; padding-top:4mm; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
.footer-left { display:flex; align-items:center; gap:6px; }
.footer-logo-mark { width:20px; height:20px; border-radius:5px; background:var(--teal); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:var(--navy); }
.footer-brand { font-size:10px; font-weight:700; color:var(--w60); }
.footer-brand span { color:var(--teal); }
.footer-url { font-size:8px; color:var(--w60); margin-top:1px; }
.footer-note { font-size:7.5px; color:var(--w60); font-style:italic; max-width:90mm; text-align:right; line-height:1.5; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      <div class="logo-mark">W</div>
      <div>
        <div class="logo-text">Wander<span>Zen</span>AI</div>
        <div class="logo-sub">Slow travel · Off the beaten path</div>
      </div>
    </div>
    <div class="header-right">
      <div class="trip-title">${escapeHtml(itinerary.title || submission.destination + ' Travel Plan')}</div>
          </div>
  </div>
  <p class="trip-summary">${plainText(itinerary.summary || 'A personalised slow travel itinerary crafted just for you.')}</p>

  <!-- Hero image -->
  ${heroImageUrl ? `
  <div class="hero">
    <img src="${heroImageUrl}" alt="${escapeHtml(submission.destination)}" />
    <div class="hero-overlay"></div>
  </div>` : ''}

  <!-- Meta bar -->
  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Destination</div>
      <div class="meta-value">${escapeHtml(submission.destination)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Duration</div>
      <div class="meta-value">${submission.days} days</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Budget</div>
      <div class="meta-value">${currencySymbol}${Number(submission.budget).toLocaleString()}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Traveller</div>
      <div class="meta-value">${escapeHtml(submission.travelerType || 'Solo')}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Est. total</div>
      <div class="meta-value">${formatMoney(itinerary.totalEstimatedCost) ? currencySymbol + formatMoney(itinerary.totalEstimatedCost) : '—'}</div>
    </div>
    ${submission.language && submission.language !== 'English' ? `
    <div class="meta-item">
      <div class="meta-label">Language</div>
      <div class="meta-value" style="font-size:10px">${escapeHtml(submission.language)}</div>
    </div>` : ''}
  </div>

  <!-- Route (route-first itineraries) -->
  ${itinerary.route?.bases?.length ? (() => {
    let day = 1;
    const rows = itinerary.route.bases.map(b => {
      const from = day; day += b.days;
      const range = b.days > 1 ? `Days ${from}–${day - 1}` : `Day ${from}`;
      const t = b.transferIn;
      const how = t ? ` · arrive by ${escapeHtml(t.mode)}${t.hours ? ` (~${escapeHtml(t.hours)} h)` : ''}` : '';
      const stay = (itinerary.stays || []).find(s => String(s.base || '').toLowerCase() === b.name.toLowerCase());
      return `
    <div class="accom-rec">${escapeHtml(range)} — ${escapeHtml(b.name)}${b.country ? `, ${escapeHtml(b.country)}` : ''}<span class="accom-why">${how}</span></div>
    ${stay ? `<div class="accom-why">Stay: ${escapeHtml(stay.type || '')}${stay.priceTier ? ` (${escapeHtml(stay.priceTier)})` : ''} — ${sanitize(stay.why || '')}</div>` : (b.why ? `<div class="accom-why">${sanitize(b.why)}</div>` : '')}
    ${b.dayTrips?.length ? `<div class="search-pills" style="margin:1mm 0 2.5mm">${b.dayTrips.map(d => `<span class="search-pill">${escapeHtml(d.name)}</span>`).join('')}</div>` : ''}`;
    }).join('');
    return `
  <div class="accom-box">
    <div class="accom-header">
      <div class="accom-dot"></div>
      <div class="accom-title">Your route</div>
    </div>${rows}
  </div>`;
  })() : ''}

  <!-- Accommodation -->
  ${itinerary.accommodation && !itinerary.stays?.length ? `
  <div class="accom-box">
    <div class="accom-header">
      <div class="accom-dot"></div>
      <div class="accom-title">Where to stay</div>
    </div>
    <div class="accom-rec">${escapeHtml(itinerary.accommodation.recommendation || '')}</div>
    <div class="accom-why">${sanitize(itinerary.accommodation.why || '')}</div>
    ${itinerary.accommodation.searchTerms?.length ? `
    <div class="search-label">Search for</div>
    <div class="search-pills">
      ${itinerary.accommodation.searchTerms.map(t => `<span class="search-pill">${escapeHtml(t)}</span>`).join('')}
    </div>` : ''}
  </div>` : ''}

  <!-- Day cards -->
  ${(itinerary.days || []).map(day => `
  <div class="day-card">
    <div class="day-header">
      <div class="day-num">${String(day.dayNumber).padStart(2, '0')}</div>
      <div class="day-info">
        <div class="day-theme">${escapeHtml(day.theme || 'Day ' + day.dayNumber)}</div>
        <div class="day-budget">${day.base ? `${day.travelDay ? 'Travel day → ' : ''}${escapeHtml(day.base)} · ` : ''}Daily budget: ${currencySymbol}${day.dailyCost || 0}</div>
      </div>
    </div>
    <div class="day-body">

      ${['morningActivity', 'afternoonActivity', 'eveningActivity'].map(period => {
        const act = day[period];
        if (!act) return '';
        const periodLabel = period.replace('Activity', '').toUpperCase();
        const place = act.venue?.name || act.location || act.activity;
        const actMapUrl = act.venue?.mapsUrl && /^https:\/\//i.test(act.venue.mapsUrl) ? act.venue.mapsUrl : mapsUrl(place, day.base, submission.destination);
        return `
        <div class="activity">
          <div class="activity-header">
            <span class="activity-time">${escapeHtml(act.time || '')}</span>
            <span class="activity-period">${periodLabel}</span>
            <span class="activity-cost ${act.isFree ? 'free' : ''}">${act.isFree ? 'Free' : currencySymbol + (act.cost || 0)}</span>
          </div>
          <div class="activity-name">${escapeHtml(act.activity || '')}</div>
          <div class="activity-location">
            ${act.location ? `<span>${escapeHtml(act.location)}</span>` : ''}
            <a href="${escapeHtml(actMapUrl)}" class="activity-map">View on map</a>
          </div>
          <div class="activity-why">${sanitize(act.why || '')}</div>
          ${act.insiderTip ? `<div class="insider-tip"><strong>Insider tip:</strong> ${sanitize(act.insiderTip)}</div>` : ''}
        </div>`;
      }).join('')}

      ${day.localEats ? `
      <div class="local-eats">
        <div class="eats-icon">🍜</div>
        <div style="flex:1">
          <div class="eats-name">${escapeHtml(day.localEats.name || '')}</div>
          <div class="eats-dish">Order: ${escapeHtml(day.localEats.dish || '')} · ${currencySymbol}${day.localEats.cost || 0}</div>
          <div class="eats-vibe">${escapeHtml(day.localEats.vibe || '')}</div>
          ${day.localEats.venue ? venueCard(day.localEats.venue) : ''}
        </div>
      </div>` : ''}

      ${day.hiddenGem ? `
      <div class="hidden-gem">
        <div class="gem-label">Hidden gem</div>
        <div class="gem-text">${sanitize(day.hiddenGem)}</div>
      </div>` : ''}

    </div>
  </div>`).join('')}

  <!-- Tips + Avoid -->
  <div class="tips-grid">
    ${itinerary.practicalTips?.length ? `
    <div class="tips-section">
      <div class="section-heading">Slow travel tips</div>
      ${itinerary.practicalTips.map(tip => `
      <div class="tip-item"><span class="tip-arrow"></span><span>${sanitize(tip)}</span></div>`).join('')}
    </div>` : ''}

    ${itinerary.avoidList?.length ? `
    <div class="tips-section">
      <div class="section-heading" style="color:rgba(255,107,107,0.7)">Skip these tourist traps</div>
      ${itinerary.avoidList.map(item => `
      <div class="avoid-item"><span class="avoid-x"></span><span>${sanitize(item)}</span></div>`).join('')}
    </div>` : ''}
  </div>

  <!-- Footer -->
  <div class="pdf-footer">
    <div class="footer-left">
      <div class="footer-logo-mark">W</div>
      <div>
        <div class="footer-brand">Wander<span>Zen</span>AI</div>
        <div class="footer-url">wanderzenai.com</div>
      </div>
    </div>
    <div class="footer-note">
      Booking links may contain affiliate codes. WanderZenAI earns a small commission at no extra cost to you. Travel safely and slowly.
    </div>
  </div>

</div>
</body>
</html>`;

// ─── Lambda handler ───────────────────────────────────────────────────────────

/**
 * Rebuild of a delivered trip from its id alone (operator re-run after a failed rebuild):
 * the trip fields the PDF and email need come from the database. Only used with `update`.
 */
async function loadTripForRebuild(db, submissionId) {
  const { rows } = await db.query(
    `SELECT s.destination, s.days, s.budget, s.language, s.traveler_type, s.email, s.plan, i.id AS itinerary_id
     FROM submissions s JOIN itineraries i ON i.submission_id = s.id
     WHERE s.id = $1 ORDER BY i.created_at DESC LIMIT 1`,
    [submissionId]
  );
  const r = rows[0];
  if (!r) throw new Error('Trip not found for rebuild');
  return {
    itineraryId: r.itinerary_id,
    email: r.email,
    isPaid: r.plan === 'paid',
    submission: { destination: r.destination, days: r.days, budget: r.budget, language: r.language || 'English', travelerType: r.traveler_type },
  };
}

exports.handler = async (event) => {
  // `update` = a rebuild after "Adjust this day": the trip is already delivered, so its
  // status is never changed here (a failed rebuild must not mark a finished trip failed).
  const update = event.update && Number.isInteger(event.update.dayNumber) ? { dayNumber: event.update.dayNumber } : null;
  const db = getDB();
  const job = update && !event.submission && event.submissionId
    ? { submissionId: event.submissionId, ...(await loadTripForRebuild(db, event.submissionId)) }
    : event;
  const { itineraryId, submissionId, email, isPaid, submission } = job;
  log.info('PDF build started', { itineraryId, update });

  let browser;

  try {
    const result = await db.query(
      `SELECT itinerary_data, currency FROM itineraries WHERE id = $1`,
      [itineraryId]
    );
    if (!result.rows.length) throw new Error('Itinerary not found');

    const itinerary = result.rows[0].itinerary_data;
    const currency = result.rows[0].currency;
    const currencySymbol = getCurrencySymbol(currency);

    // Log social media availability in itinerary
    const venuesWithSocial = [];
    (itinerary.days || []).forEach(day => {
      ['morningActivity', 'afternoonActivity', 'eveningActivity'].forEach(period => {
        const act = day[period];
        if (act && act.venue && act.venue.social) {
          venuesWithSocial.push({
            name: act.venue.name,
            social: Object.keys(act.venue.social).filter(k => act.venue.social[k])
          });
        }
      });
      if (day.localEats && day.localEats.venue && day.localEats.venue.social) {
        venuesWithSocial.push({
          name: day.localEats.venue.name,
          social: Object.keys(day.localEats.venue.social).filter(k => day.localEats.venue.social[k])
        });
      }
    });

    log.info('PDF render — social media audit', {
      itineraryId,
      submissionId,
      totalDays: (itinerary.days || []).length,
      venuesWithSocial: venuesWithSocial.length,
      socialVenues: venuesWithSocial
    });

    // Fetch hero image from recommendations_cache
    let heroImageUrl = null;
    try {
      const heroResult = await db.query(
        `SELECT image_url FROM recommendations_cache WHERE LOWER(destination) = LOWER($1) LIMIT 1`,
        [submission.destination]
      );
      heroImageUrl = heroResult.rows[0]?.image_url || null;
    } catch (e) {
      log.warn('Hero image fetch failed', { destination: submission.destination });
    }

    browser = await launchBrowser();

    const page = await browser.newPage();
    const html = buildHTML(itinerary, submission, currencySymbol, heroImageUrl);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      ...PDF_PAGE_OPTIONS,
    });

    await browser.close();
    browser = null;

    log.info('PDF generated', { itineraryId, bytes: pdfBuffer.length });

    const s3Key = `itineraries/${email}/${itineraryId}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.PDF_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="WanderZen-${submission.destination.replace(/\s+/g, '-')}-${submission.days}days.pdf"`,
      Metadata: { itineraryId, email, destination: submission.destination },
    }));

    await db.query(
      `UPDATE itineraries SET pdf_s3_key = $1, pdf_generated_at = NOW() WHERE id = $2`,
      [s3Key, itineraryId]
    );

    if (!update) {
      await db.query(
        `UPDATE submissions SET status = 'pdf_ready', updated_at = NOW() WHERE id = $1`,
        [submissionId]
      );
    }

    log.info('PDF uploaded', { itineraryId, s3Key, update });

    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-email-sender-${process.env.STAGE}`,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({
        itineraryId, submissionId, email, s3Key,
        destination: submission.destination,
        days: submission.days,
        isPaid,
        itineraryTitle: itinerary.title,
        ...(update ? { update } : {}),
      })),
    }));

  } catch (err) {
    log.error('PDF build failed', { itineraryId, update, error: err.message });
    if (browser) await browser.close().catch(() => {});
    if (update) return; // the trip and its previous PDF stay as they were
    await db.query(
      `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, submissionId]
    ).catch(() => {});
  }
};

// Exported for unit tests.
exports._internal = { buildHTML, launchBrowser, PDF_PAGE_OPTIONS };
