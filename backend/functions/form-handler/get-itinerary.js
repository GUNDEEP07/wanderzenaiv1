'use strict';

const { getDB, ok, notFound, serverError, log } = require('/opt/nodejs/index');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }, body: '' };
  }

  const submissionId = event.pathParameters?.id;
  if (!submissionId) return notFound('Submission ID required');

  const db = getDB();
  try {
    const result = await db.query(
      `SELECT id, status, destination, error_message, email_sent_at 
       FROM submissions WHERE id = $1`,
      [submissionId]
    );

    if (!result.rows.length) return notFound('Submission not found');

    const row = result.rows[0];
    return ok({
      submissionId: row.id,
      status: row.status,
      destination: row.destination,
      error_message: row.error_message,
      email_sent_at: row.email_sent_at,
    });

  } catch (err) {
    log.error('Get itinerary error', { submissionId, error: err.message });
    return serverError('Failed to fetch status');
  }
};
