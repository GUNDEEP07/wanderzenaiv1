'use strict';

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, getCurrencySymbol, log } = require('/opt/nodejs/index');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

// ─── HTML → PDF Template ─────────────────────────────────────────────────────
const buildHTML = (itinerary, submission, currencySymbol) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Serif+4:wght@300;400;600&display=swap');

  :root {
    --deep-forest: #1a2e20;
    --sage: #4a7c59;
    --warm-stone: #c8b89a;
    --cream: #faf7f2;
    --ink: #2c2416;
    --mist: #e8f0ea;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Source Serif 4', Georgia, serif;
    background: var(--cream);
    color: var(--ink);
    font-size: 11px;
    line-height: 1.7;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 16mm 18mm;
    background: var(--cream);
  }

  /* ── Header ── */
  .header {
    border-bottom: 2px solid var(--deep-forest);
    padding-bottom: 10mm;
    margin-bottom: 8mm;
  }
  .brand {
    font-family: 'Playfair Display', serif;
    font-size: 9px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--sage);
    margin-bottom: 4mm;
  }
  .trip-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: var(--deep-forest);
    line-height: 1.2;
    margin-bottom: 3mm;
  }
  .trip-summary {
    font-size: 11px;
    color: #5a5040;
    line-height: 1.7;
    max-width: 160mm;
    font-style: italic;
  }

  /* ── Trip Meta Bar ── */
  .meta-bar {
    display: flex;
    gap: 0;
    background: var(--deep-forest);
    border-radius: 4px;
    margin: 6mm 0;
    overflow: hidden;
  }
  .meta-item {
    flex: 1;
    padding: 4mm 5mm;
    text-align: center;
    border-right: 1px solid rgba(255,255,255,0.1);
  }
  .meta-item:last-child { border-right: none; }
  .meta-label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--warm-stone);
    margin-bottom: 1mm;
  }
  .meta-value {
    font-family: 'Playfair Display', serif;
    font-size: 13px;
    color: white;
    font-weight: 700;
  }

  /* ── Accommodation Box ── */
  .accom-box {
    background: var(--mist);
    border-left: 3px solid var(--sage);
    padding: 5mm 6mm;
    margin-bottom: 6mm;
    border-radius: 0 4px 4px 0;
  }
  .accom-title {
    font-family: 'Playfair Display', serif;
    font-size: 13px;
    color: var(--deep-forest);
    margin-bottom: 2mm;
  }
  .accom-rec { font-weight: 600; color: var(--sage); }
  .accom-why { color: #5a5040; font-style: italic; font-size: 10px; margin-top: 1mm; }
  .search-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3mm; }
  .pill {
    background: white;
    border: 1px solid var(--sage);
    color: var(--sage);
    font-size: 8px;
    padding: 1mm 3mm;
    border-radius: 20px;
    font-weight: 600;
  }

  /* ── Day Card ── */
  .day-card {
    background: white;
    border-radius: 6px;
    margin-bottom: 5mm;
    overflow: hidden;
    border: 1px solid rgba(74, 124, 89, 0.15);
    page-break-inside: avoid;
  }
  .day-header {
    background: var(--deep-forest);
    padding: 4mm 6mm;
    display: flex;
    align-items: baseline;
    gap: 4mm;
  }
  .day-number {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: var(--warm-stone);
    font-weight: 700;
    line-height: 1;
  }
  .day-info { flex: 1; }
  .day-theme {
    font-family: 'Playfair Display', serif;
    font-size: 14px;
    color: white;
    line-height: 1.2;
  }
  .day-budget {
    font-size: 9px;
    color: var(--warm-stone);
    margin-top: 1mm;
  }
  .day-body { padding: 5mm 6mm; }

  /* ── Activity ── */
  .activity { margin-bottom: 4mm; padding-bottom: 4mm; border-bottom: 1px dashed rgba(74,124,89,0.2); }
  .activity:last-of-type { border-bottom: none; margin-bottom: 0; }
  .activity-time-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 1mm; }
  .activity-time {
    font-size: 8px;
    font-weight: 700;
    color: var(--sage);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    min-width: 20mm;
  }
  .activity-period {
    font-size: 8px;
    color: #9a8c78;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .activity-name {
    font-family: 'Playfair Display', serif;
    font-size: 12px;
    color: var(--deep-forest);
    margin-bottom: 1mm;
  }
  .activity-location { font-size: 9px; color: var(--sage); font-weight: 600; margin-bottom: 1mm; }
  .activity-why { font-size: 10px; color: #5a5040; line-height: 1.6; margin-bottom: 1mm; }
  .activity-cost {
    font-size: 9px;
    font-weight: 700;
    color: var(--deep-forest);
    display: inline-block;
    background: var(--mist);
    padding: 0.5mm 2mm;
    border-radius: 3px;
    margin-bottom: 1mm;
  }
  .insider-tip {
    background: #fff9f0;
    border-left: 2px solid var(--warm-stone);
    padding: 2mm 3mm;
    font-size: 9px;
    color: #7a6a50;
    font-style: italic;
    margin-top: 1.5mm;
    border-radius: 0 3px 3px 0;
  }

  /* ── Hidden Gem ── */
  .hidden-gem {
    background: linear-gradient(135deg, var(--deep-forest) 0%, #2d4a35 100%);
    border-radius: 4px;
    padding: 4mm 5mm;
    margin-top: 4mm;
  }
  .gem-label {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--warm-stone);
    margin-bottom: 1mm;
  }
  .gem-text { font-size: 10px; color: white; line-height: 1.6; font-style: italic; }

  /* ── Local Eats ── */
  .local-eats {
    background: var(--mist);
    border-radius: 4px;
    padding: 3mm 4mm;
    margin-top: 3mm;
    display: flex;
    align-items: flex-start;
    gap: 3mm;
  }
  .eats-icon { font-size: 14px; }
  .eats-name { font-weight: 700; font-size: 10px; color: var(--deep-forest); }
  .eats-dish { font-size: 9px; color: var(--sage); }
  .eats-vibe { font-size: 9px; color: #7a6a50; font-style: italic; }

  /* ── Practical Tips ── */
  .tips-section { margin-top: 6mm; page-break-inside: avoid; }
  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    color: var(--deep-forest);
    border-bottom: 1px solid var(--warm-stone);
    padding-bottom: 2mm;
    margin-bottom: 4mm;
  }
  .tip-item {
    display: flex;
    gap: 3mm;
    margin-bottom: 2mm;
    font-size: 10px;
    line-height: 1.6;
  }
  .tip-bullet { color: var(--sage); font-weight: 700; flex-shrink: 0; }

  /* ── Avoid List ── */
  .avoid-item {
    display: flex; gap: 3mm; margin-bottom: 2mm;
    font-size: 10px; line-height: 1.6;
    color: #7a5a50;
  }
  .avoid-bullet { color: #c0604a; font-weight: 700; flex-shrink: 0; }

  /* ── Footer ── */
  .footer {
    margin-top: 8mm;
    padding-top: 4mm;
    border-top: 1px solid var(--warm-stone);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    color: #9a8c78;
  }
  .footer-brand {
    font-family: 'Playfair Display', serif;
    font-size: 11px;
    color: var(--sage);
    font-weight: 700;
  }
  .affiliate-note { font-size: 7px; color: #b0a090; font-style: italic; max-width: 80mm; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">WanderZenAI · Slow Travel Itineraries</div>
    <div class="trip-title">${itinerary.title}</div>
    <div class="trip-summary">${itinerary.summary}</div>
  </div>

  <!-- Meta Bar -->
  <div class="meta-bar">
    <div class="meta-item">
      <div class="meta-label">Destination</div>
      <div class="meta-value">${submission.destination}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Duration</div>
      <div class="meta-value">${submission.days} days</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Budget</div>
      <div class="meta-value">${currencySymbol}${submission.budget}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Traveller</div>
      <div class="meta-value">${submission.travelerType}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Est. Total</div>
      <div class="meta-value">${currencySymbol}${itinerary.totalEstimatedCost}</div>
    </div>
  </div>

  <!-- Accommodation -->
  <div class="accom-box">
    <div class="accom-title">Where to Stay</div>
    <div class="accom-rec">${itinerary.accommodation?.recommendation || 'Local guesthouse or boutique homestay'}</div>
    <div class="accom-why">${itinerary.accommodation?.why || 'Away from tourist crowds, close to local life'}</div>
    ${itinerary.accommodation?.searchTerms?.length ? `
    <div class="search-pills">
      ${itinerary.accommodation.searchTerms.map(t => `<span class="pill">${t}</span>`).join('')}
    </div>` : ''}
  </div>

  <!-- Day Cards -->
  ${(itinerary.days || []).map(day => `
  <div class="day-card">
    <div class="day-header">
      <div class="day-number">${day.dayNumber}</div>
      <div class="day-info">
        <div class="day-theme">${day.theme}</div>
        <div class="day-budget">Daily budget: ${currencySymbol}${day.dailyCost || 0}</div>
      </div>
    </div>
    <div class="day-body">

      ${['morningActivity', 'afternoonActivity', 'eveningActivity'].map(period => {
        const act = day[period];
        if (!act) return '';
        const periodLabel = period.replace('Activity', '').toUpperCase();
        return `
        <div class="activity">
          <div class="activity-time-row">
            <span class="activity-time">${act.time || ''}</span>
            <span class="activity-period">${periodLabel}</span>
            <span class="activity-cost">${act.isFree ? 'Free' : `${currencySymbol}${act.cost || 0}`}</span>
          </div>
          <div class="activity-name">${act.activity || ''}</div>
          <div class="activity-location">${act.location || ''}</div>
          <div class="activity-why">${act.why || ''}</div>
          ${act.insiderTip ? `<div class="insider-tip">Insider tip: ${act.insiderTip}</div>` : ''}
        </div>`;
      }).join('')}

      ${day.localEats ? `
      <div class="local-eats">
        <span class="eats-icon">🍜</span>
        <div>
          <div class="eats-name">${day.localEats.name}</div>
          <div class="eats-dish">Order: ${day.localEats.dish} · ${currencySymbol}${day.localEats.cost}</div>
          <div class="eats-vibe">${day.localEats.vibe}</div>
        </div>
      </div>` : ''}

      ${day.hiddenGem ? `
      <div class="hidden-gem">
        <div class="gem-label">Hidden Gem</div>
        <div class="gem-text">${day.hiddenGem}</div>
      </div>` : ''}
    </div>
  </div>
  `).join('')}

  <!-- Practical Tips -->
  ${itinerary.practicalTips?.length ? `
  <div class="tips-section">
    <div class="section-title">Slow Travel Tips for ${submission.destination}</div>
    ${itinerary.practicalTips.map(tip => `
    <div class="tip-item">
      <span class="tip-bullet">→</span>
      <span>${tip}</span>
    </div>`).join('')}
  </div>` : ''}

  <!-- Avoid List -->
  ${itinerary.avoidList?.length ? `
  <div class="tips-section" style="margin-top:4mm">
    <div class="section-title">Skip These Tourist Traps</div>
    ${itinerary.avoidList.map(item => `
    <div class="avoid-item">
      <span class="avoid-bullet">✕</span>
      <span>${item}</span>
    </div>`).join('')}
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>
      <div class="footer-brand">WanderZenAI</div>
      <div>wanderzenai.com · Crafted for slow travellers</div>
    </div>
    <div class="affiliate-note">
      Booking links may contain affiliate codes. WanderZenAI earns a small commission at no extra cost to you.
    </div>
  </div>

</div>
</body>
</html>`;

exports.handler = async (event) => {
  const { itineraryId, submissionId, email, isPaid, submission } = event;
  log.info('PDF build started', { itineraryId, email });

  const db = getDB();
  let browser;

  try {
    // ─── Fetch itinerary from DB ─────────────────────────────────────────────
    const result = await db.query(
      `SELECT itinerary_data, currency FROM itineraries WHERE id = $1`,
      [itineraryId]
    );

    if (!result.rows.length) throw new Error('Itinerary not found');

    const itinerary = result.rows[0].itinerary_data;
    const currency = result.rows[0].currency;
    const currencySymbol = getCurrencySymbol(currency);

    // ─── Launch Puppeteer ──────────────────────────────────────────────────
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    const html = buildHTML(itinerary, submission, currencySymbol);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await browser.close();
    browser = null;

    log.info('PDF generated', { itineraryId, size: pdfBuffer.length });

    // ─── Upload to S3 ──────────────────────────────────────────────────────
    const s3Key = `itineraries/${email}/${itineraryId}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket: process.env.PDF_BUCKET,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: `attachment; filename="WanderZen-${submission.destination.replace(/\s+/g, '-')}-${submission.days}days.pdf"`,
      Metadata: {
        itineraryId,
        email,
        destination: submission.destination,
        plan: isPaid ? 'paid' : 'free',
      },
      Tagging: `plan=${isPaid ? 'paid' : 'free'}`,
    }));

    // ─── Store S3 key in DB ────────────────────────────────────────────────
    await db.query(
      `UPDATE itineraries SET pdf_s3_key = $1, pdf_generated_at = NOW() WHERE id = $2`,
      [s3Key, itineraryId]
    );

    await db.query(
      `UPDATE submissions SET status = 'pdf_ready', updated_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    log.info('PDF uploaded to S3', { itineraryId, s3Key });

    // ─── Trigger email sender ──────────────────────────────────────────────
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
