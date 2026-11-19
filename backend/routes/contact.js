const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Contact = require('../models/Contact');
const { clientIp } = require('../client-ip');
const { verifyTurnstileToken } = require('../turnstile');

const COOLDOWN_MS = 30000;
const LIMITS = { name: 100, subject: 200, message: 2000 };
const rateLimitStore = new Map();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

const EMAIL_FONT = "'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', 'Trebuchet MS', sans-serif";

function buildEmailHtml({ name, subject, message, ip, userAgent, formDuration }) {
  const body = escapeHtml(message.trim()).replace(/\n/g, '<br>');
  const preview = escapeHtml(message.trim().replace(/\s+/g, ' ').slice(0, 140));
  const meta = [
    ['Time on form', `${Math.round(formDuration / 1000)}s`],
    ['Received', new Date().toLocaleString()],
    ['IP address', ip],
    ['User agent', userAgent || 'Unknown'],
  ];
  const metaRows = meta.map(([label, value]) => `
                <tr>
                  <td style="padding: 3px 16px 3px 0; white-space: nowrap; vertical-align: top; color: #57554c;">${label}</td>
                  <td style="padding: 3px 0; vertical-align: top; color: #2b2a26; word-break: break-word;">${escapeHtml(value)}</td>
                </tr>`).join('');

  return `
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preview}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #dad7cd;">
      <tr>
        <td align="center" style="padding: 32px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #f0efeb; border-radius: 12px; font-family: ${EMAIL_FONT};">
            <tr>
              <td style="padding: 36px 32px 28px;">
                <h1 style="margin: 0; font-size: 26px; line-height: 1.2; font-weight: 700; letter-spacing: -0.5px; color: #344e41;">${escapeHtml(subject.trim())}</h1>
                <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.4; color: #57554c;">From <strong style="font-weight: 600; color: #3a5a40;">${escapeHtml(name.trim())}</strong> via your portfolio</p>
                <p style="margin: 28px 0 0; font-size: 17px; line-height: 1.6; color: #2b2a26;">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 32px;"><div style="height: 1px; line-height: 1px; font-size: 0; background-color: #d4d0c3;">&nbsp;</div></td>
            </tr>
            <tr>
              <td style="padding: 20px 32px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; line-height: 1.5;">${metaRows}
                </table>
                <p style="margin: 16px 0 0; font-size: 13px; line-height: 1.5; color: #57554c;">Verified by Cloudflare Turnstile</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

router.post('/', async (req, res) => {
  try {
    const { name, subject, message, website, turnstileToken, formStartTime } = req.body || {};
    const fields = { name, subject, message };

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value !== 'string' || value.trim() === '') {
        return res.status(400).json({ message: 'Name, subject, and message are required' });
      }
      if (value.length > LIMITS[key]) {
        return res.status(400).json({ message: 'Input exceeds maximum length' });
      }
    }

    // Honeypot: hidden from people, filled in by naive bots. Answer like a success so bots learn nothing.
    if (typeof website === 'string' && website.trim() !== '') {
      return res.status(201).json({ message: 'Message sent successfully! I\'ll get back to you soon.' });
    }

    const ip = clientIp(req);
    const now = Date.now();
    const lastSubmission = rateLimitStore.get(ip);
    if (lastSubmission && now - lastSubmission < COOLDOWN_MS) {
      return res.status(429).json({ message: 'Please wait a few seconds before sending another message.' });
    }

    const verification = await verifyTurnstileToken(turnstileToken, ip);
    if (!verification.ok) {
      if (verification.reason === 'missing-secret') {
        console.error('Contact form: TURNSTILE_SECRET_KEY is not set; rejecting submissions.');
        return res.status(503).json({ message: 'The contact form is temporarily unavailable. Please reach out on LinkedIn instead.' });
      }
      console.warn('Contact form: Turnstile verification failed:', verification.reason);
      return res.status(400).json({ message: 'Verification failed. Please complete the check again and resend.' });
    }

    rateLimitStore.set(ip, now);

    const startedAt = Number(formStartTime);
    const formDuration = Number.isFinite(startedAt) && startedAt > 0 && startedAt <= now ? now - startedAt : 0;
    const userAgent = req.get('User-Agent');

    const contact = new Contact({
      name: name.trim(),
      email: '',
      subject: subject.trim(),
      message: message.trim(),
      ipAddress: ip,
      userAgent,
      submissionTime: new Date(),
      formDuration
    });

    await contact.save();

    // The message is stored at this point. A mail failure is logged for the site owner,
    // but the visitor is not told their message failed.
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: `Portfolio Contact: ${subject.trim().replace(/[\r\n]+/g, ' ')}`,
        html: buildEmailHtml({ name, subject, message, ip, userAgent, formDuration })
      });
    } catch (mailError) {
      console.error(`Contact form: saved message ${contact._id} but email notification failed:`, mailError.message);
    }

    res.status(201).json({
      message: 'Message sent successfully! I\'ll get back to you soon.',
      id: contact._id
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
});

setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [key, timestamp] of rateLimitStore.entries()) {
    if (timestamp < oneHourAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000).unref();

module.exports = router;
module.exports.escapeHtml = escapeHtml;
