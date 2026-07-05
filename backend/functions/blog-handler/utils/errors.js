'use strict';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Content-Type': 'application/json',
};

const buildResponse = (statusCode, error) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify({ error }),
});

const badRequest = (message) => buildResponse(400, message);

const unauthorized = () => buildResponse(401, 'Unauthorized');

const notFound = (message) => buildResponse(404, message);

const conflict = (message) => buildResponse(409, message);

const serverError = (message) => buildResponse(500, message);

module.exports = {
  badRequest,
  unauthorized,
  notFound,
  conflict,
  serverError,
};
