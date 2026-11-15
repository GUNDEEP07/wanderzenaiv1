'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: 'ap-southeast-2' });

/** Plain transactional email from FROM_EMAIL (failure notices). */
const sendEmail = ({ to, subject, text, html }) => ses.send(new SendEmailCommand({
  Source: `WanderZenAI <${process.env.FROM_EMAIL}>`,
  Destination: { ToAddresses: [to] },
  Message: {
    Subject: { Data: subject, Charset: 'UTF-8' },
    Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
  },
}));

module.exports = { sendEmail };
