'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, getCurrencySymbol, log } = require('/opt/nodejs/index');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

// ─── Text helpers ─────────────────────────────────────────────────────────────

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Convert [text](url) markdown → proper HTML anchor tags
// Also strips leftover broken URL fragments that Claude sometimes emits
const sanitize = (text) => {
  if (!text) return '';
  let result = String(text);
  // Replace well-formed markdown links
  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label, url) => {
      let display = label;
      try { display = decodeURIComponent(label); } catch (_) {}
      return `<a href="${url.replace(/"/g, '%22')}" style="color:var(--teal);text-decoration:none;font-weight:600">${escapeHtml(display)}</a>`;
    }
  );
  // Strip leftover broken URL fragments like: )%2C%20JP) or map%2C...JP)
  result = result.replace(/\)%[0-9A-Fa-f]{2}[\w%.,()-]*/g, '');
  result = result.replace(/\bmap%[0-9A-Fa-f][\w%]*\b/g, '');
  return result;
};

// Build Google Maps search URL from venue name + location
const mapsUrl = (name, area, country) =>
  `https://maps.google.com/?q=${encodeURIComponent([name, area, country].filter(Boolean).join(', '))}`;

// ─── Social media links ───────────────────────────────────────────────────────

const socialLinks = (social) => {
  if (!social) return '';
  const links = [];
  if (social.instagram) links.push(`<a href="https://instagram.com/${social.instagram}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">📷 @${escapeHtml(social.instagram)}</a>`);
  if (social.twitter) links.push(`<a href="https://twitter.com/${social.twitter}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">𝕏 @${escapeHtml(social.twitter)}</a>`);
  if (social.facebook_id) links.push(`<a href="https://facebook.com/${social.facebook_id}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🌐 Facebook</a>`);
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
        <a href="${mapLink}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">📍 Google Maps</a>
        ${fsqLink ? `<a href="${fsqLink}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🔍 Foursquare</a>` : ''}
        ${venue.tel ? `<span style="color:rgba(255,255,255,0.4);font-size:8px">📞 ${escapeHtml(venue.tel)}</span>` : ''}
        ${venue.website ? `<a href="${venue.website}" style="color:var(--teal);text-decoration:none;font-size:8px;font-weight:600">🌐 Website</a>` : ''}
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
  -webkit-font-smoothing:antialiased;
}

.page { width:210mm; min-height:297mm; padding:14mm 16mm; background:var(--navy); }

.header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:6mm; border-bottom:1px solid var(--border); margin-bottom:6mm; }
.logo-area { display:flex; align-items:center; gap:8px; }
.logo-mark { width:32px; height:32px; border-radius:8px; background:var(--teal); display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:var(--navy); flex-shrink:0; }
.logo-text { font-size:16px; font-weight:700; color:var(--white); letter-spacing:-0.02em; }
.logo-text span { color:var(--teal); }
.logo-sub { font-size:8px; color:var(--w30); letter-spacing:0.15em; text-transform:uppercase; margin-top:1px; }
.header-right { text-align:right; }
.trip-title { font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:var(--white); line-height:1.2; letter-spacing:-0.02em; max-width:120mm; text-align:right; }
.trip-summary { font-size:9px; color:var(--w60); margin-top:3px; max-width:120mm; text-align:right; line-height:1.6; font-style:italic; }

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
.accom-why { font-size:9px; color:var(--w60); font-style:italic; line-height:1.6; }
.search-label { font-size:7px; color:var(--w30); letter-spacing:0.1em; text-transform:uppercase; margin-top:3mm; margin-bottom:2mm; font-weight:600; }
.search-pills { display:flex; flex-wrap:wrap; gap:4px; }
.search-pill { font-size:8px; padding:2px 8px; border:1px solid var(--teal-br); border-radius:100px; color:var(--teal); background:rgba(0,212,170,0.05); font-weight:600; }

.day-card { background:var(--navy-2); border:1px solid var(--border); border-radius:10px; margin-bottom:4mm; overflow:hidden; page-break-inside:avoid; }
.day-header { background:var(--navy-3); padding:3.5mm 5mm; display:flex; align-items:center; gap:4mm; border-bottom:1px solid var(--border); }
.day-num { font-family:'Fraunces',serif; font-size:26px; font-weight:700; color:var(--teal); line-height:1; letter-spacing:-0.03em; flex-shrink:0; }
.day-info { flex:1; }
.day-theme { font-size:12px; font-weight:700; color:var(--white); letter-spacing:-0.01em; line-height:1.2; }
.day-budget { font-size:8px; color:var(--w30); margin-top:2px; }
.day-body { padding:4mm 5mm; }

.activity { padding-bottom:3.5mm; margin-bottom:3.5mm; border-bottom:1px solid var(--border); }
.activity:last-of-type { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.activity-header { display:flex; align-items:center; gap:3mm; margin-bottom:1.5mm; }
.activity-time { font-size:8px; font-weight:700; color:var(--teal); letter-spacing:0.05em; min-width:18mm; }
.activity-period { font-size:7px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase; color:var(--w30); }
.activity-cost { margin-left:auto; font-size:8px; font-weight:700; color:var(--navy); background:var(--teal); padding:1.5px 6px; border-radius:4px; }
.activity-cost.free { background:rgba(0,212,170,0.15); color:var(--teal); }
.activity-name { font-size:11px; font-weight:700; color:var(--white); margin-bottom:1mm; letter-spacing:-0.01em; line-height:1.3; }
.activity-location { font-size:9px; color:var(--teal); font-weight:600; margin-bottom:1.5mm; }
.activity-map { display:inline-block; font-size:8px; color:var(--teal); text-decoration:none; font-weight:600; margin-bottom:1.5mm; padding:1px 6px; border:1px solid rgba(0,212,170,0.3); border-radius:4px; }
.activity-why { font-size:9.5px; color:var(--w60); line-height:1.6; margin-bottom:1.5mm; }
.insider-tip { background:rgba(255,217,61,0.06); border-left:2px solid var(--gold); padding:2mm 3mm; font-size:8.5px; color:rgba(255,217,61,0.8); font-style:italic; line-height:1.5; border-radius:0 4px 4px 0; }

.local-eats { background:rgba(255,107,107,0.06); border:1px solid rgba(255,107,107,0.15); border-radius:8px; padding:3mm 4mm; margin-top:3mm; display:flex; gap:3mm; align-items:flex-start; }
.eats-icon { width:24px; height:24px; border-radius:6px; background:rgba(255,107,107,0.15); display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; }
.eats-name { font-size:10px; font-weight:700; color:var(--white); margin-bottom:1px; }
.eats-dish { font-size:8.5px; color:rgba(255,107,107,0.8); margin-bottom:1px; }
.eats-vibe { font-size:8px; color:var(--w60); font-style:italic; }

.hidden-gem { background:linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,212,170,0.04)); border:1px solid var(--teal-br); border-radius:8px; padding:3mm 4mm; margin-top:3mm; }
.gem-label { font-size:7px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--teal); margin-bottom:1.5mm; display:flex; align-items:center; gap:5px; }
.gem-label::before { content:''; display:inline-block; width:12px; height:1px; background:var(--teal); }
.gem-text { font-size:9.5px; color:var(--w90); line-height:1.6; font-style:italic; }

.tips-grid { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-top:5mm; align-items:start; }
.tips-section { background:var(--navy-2); border:1px solid var(--border); border-radius:10px; padding:4mm 5mm; break-inside:avoid; }
.section-heading { font-size:7px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:var(--teal); margin-bottom:3mm; display:flex; align-items:center; gap:8px; }
.section-heading::after { content:''; flex:1; height:1px; background:var(--border); }
.tip-item { display:flex; gap:3mm; margin-bottom:2mm; font-size:9.5px; line-height:1.6; color:var(--w60); }
.tip-arrow { color:var(--teal); flex-shrink:0; font-weight:700; }
.avoid-item { display:flex; gap:3mm; margin-bottom:2mm; font-size:9.5px; line-height:1.6; color:rgba(255,107,107,0.7); }
.avoid-x { color:var(--coral); flex-shrink:0; font-weight:700; }

.pdf-footer { margin-top:6mm; padding-top:4mm; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
.footer-left { display:flex; align-items:center; gap:6px; }
.footer-logo-mark { width:20px; height:20px; border-radius:5px; background:var(--teal); display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; color:var(--navy); }
.footer-brand { font-size:10px; font-weight:700; color:var(--w60); }
.footer-brand span { color:var(--teal); }
.footer-url { font-size:8px; color:var(--w30); margin-top:1px; }
.footer-note { font-size:7.5px; color:var(--w30); font-style:italic; max-width:90mm; text-align:right; line-height:1.5; }
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
      <div class="trip-summary">${sanitize(itinerary.summary || 'A personalised slow travel itinerary crafted just for you.')}</div>
    </div>
  </div>

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
      <div class="meta-value">${currencySymbol}${itinerary.totalEstimatedCost || '—'}</div>
    </div>
    ${submission.language && submission.language !== 'English' ? `
    <div class="meta-item">
      <div class="meta-label">Language</div>
      <div class="meta-value" style="font-size:10px">${escapeHtml(submission.language)}</div>
    </div>` : ''}
  </div>

  <!-- Accommodation -->
  ${itinerary.accommodation ? `
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
        <div class="day-budget">Daily budget: ${currencySymbol}${day.dailyCost || 0}</div>
      </div>
    </div>
    <div class="day-body">

      ${['morningActivity', 'afternoonActivity', 'eveningActivity'].map(period => {
        const act = day[period];
        if (!act) return '';
        const periodLabel = period.replace('Activity', '').toUpperCase();
        const actMapUrl = mapsUrl(act.location || act.activity, submission.destination, '');
        return `
        <div class="activity">
          <div class="activity-header">
            <span class="activity-time">${escapeHtml(act.time || '')}</span>
            <span class="activity-period">${periodLabel}</span>
            <span class="activity-cost ${act.isFree ? 'free' : ''}">${act.isFree ? 'Free' : currencySymbol + (act.cost || 0)}</span>
          </div>
          <div class="activity-name">${escapeHtml(act.activity || '')}</div>
          <div class="activity-location">${escapeHtml(act.location || '')}</div>
          <a href="${actMapUrl}" class="activity-map">📍 View on map</a>
          <div class="activity-why">${sanitize(act.why || '')}</div>
          ${act.insiderTip ? `<div class="insider-tip">Insider tip: ${sanitize(act.insiderTip)}</div>` : ''}
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
      <div class="tip-item"><span class="tip-arrow">→</span><span>${sanitize(tip)}</span></div>`).join('')}
    </div>` : ''}

    ${itinerary.avoidList?.length ? `
    <div class="tips-section">
      <div class="section-heading" style="color:rgba(255,107,107,0.7)">Skip these tourist traps</div>
      ${itinerary.avoidList.map(item => `
      <div class="avoid-item"><span class="avoid-x">✕</span><span>${sanitize(item)}</span></div>`).join('')}
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

exports.handler = async (event) => {
  const { itineraryId, submissionId, email, isPaid, submission } = event;
  log.info('PDF build started', { itineraryId, email });

  const db = getDB();
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

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const html = buildHTML(itinerary, submission, currencySymbol, heroImageUrl);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
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

    await db.query(
      `UPDATE submissions SET status = 'pdf_ready', updated_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    log.info('PDF uploaded', { itineraryId, s3Key });

    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-email-sender-${process.env.STAGE}`,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({
        itineraryId, submissionId, email, s3Key,
        destination: submission.destination,
        days: submission.days,
        isPaid,
        itineraryTitle: itinerary.title,
      })),
    }));

  } catch (err) {
    log.error('PDF build failed', { itineraryId, error: err.message });
    if (browser) await browser.close().catch(() => {});
    await db.query(
      `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, submissionId]
    ).catch(() => {});
  }
};
