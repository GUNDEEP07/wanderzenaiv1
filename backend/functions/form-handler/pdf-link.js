'use strict';

/**
 * GET /itinerary/{id}/pdf — a fresh, short-lived download link for the trip's PDF.
 *
 * Replaces the 7-day signed URL in the email, which really lasted only as long as the
 * Lambda's temporary credentials (often a few hours). The email now links to the trip page,
 * and the page asks for a new link on every click.
 *
 * Owner only: the PDF's S3 key contains the owner's email, so the signed URL is never handed
 * to someone holding just the share link. Another user's trip, or an unknown id, is a 404.
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { log } = require('/opt/nodejs/index');

const SUBMISSION_ID = /^wz_[a-z0-9]{6,12}_[A-Za-z0-9_-]{16}$/;
const LINK_SECONDS = 15 * 60;

let s3;
const s3Client = () => (s3 ||= new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' }));

/** The trip id when this is GET /itinerary/{id}/pdf, else null ('bad' for a malformed id). */
function pdfRouteOf(event) {
  if (event.httpMethod !== 'GET') return null;
  const m = (event.path || '').match(/\/itinerary\/([^/]+)\/pdf$/);
  if (!m) return null;
  const id = event.pathParameters?.id || m[1];
  return SUBMISSION_ID.test(id) ? id : 'bad';
}

/** File name the browser saves: "WanderZen-Vietnam-6-days.pdf" (ASCII only, for the header). */
function downloadName(destination, days) {
  const place = String(destination || 'trip')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'trip';
  return `WanderZen-${place}${days ? `-${parseInt(days, 10)}-days` : ''}.pdf`;
}

async function findPdf(db, submissionId, user) {
  const { rows } = await db.query(
    `SELECT s.email, s.destination, s.days, i.pdf_s3_key
       FROM submissions s
       JOIN itineraries i ON i.submission_id = s.id
      WHERE s.id = $1
      ORDER BY i.pdf_generated_at DESC NULLS LAST
      LIMIT 1`,
    [submissionId],
  );
  const row = rows[0];
  if (!row || !user?.email || String(row.email).toLowerCase() !== String(user.email).toLowerCase()) return null;
  return row;
}

/**
 * @param {object} deps { ok, notFound, serverError, sign? } — response helpers from the handler;
 *        `sign` is injectable for tests.
 */
async function handlePdfLink(db, submissionId, user, deps) {
  const { ok, notFound, serverError } = deps;
  const sign = deps.sign || ((key, name) => getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: process.env.PDF_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${name}"`,
      ResponseContentType: 'application/pdf',
    }),
    { expiresIn: LINK_SECONDS },
  ));
  try {
    const row = await findPdf(db, submissionId, user);
    if (!row) return notFound('Trip not found');
    if (!row.pdf_s3_key) return notFound('The PDF for this trip is not ready yet');
    if (!process.env.PDF_BUCKET && !deps.sign) throw new Error('PDF_BUCKET not set');
    const fileName = downloadName(row.destination, row.days);
    const url = await sign(row.pdf_s3_key, fileName);
    return ok({ url, fileName, expiresInSeconds: LINK_SECONDS });
  } catch (err) {
    log.error('PDF link failed', { submissionId, error: err.message });
    return serverError('Could not prepare the download — please try again.');
  }
}

module.exports = { pdfRouteOf, handlePdfLink, downloadName, LINK_SECONDS };
