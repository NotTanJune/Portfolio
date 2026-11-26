import { verifyTurnstileToken } from './turnstile.js';
import { buildEmailHtml, buildEmailSubject, buildEmailText } from './email.js';

export const COOLDOWN_MS = 30000;
export const LIMITS = { name: 100, subject: 200, message: 2000 };
const MAX_BODY_BYTES = 16 * 1024;

const SUCCESS = 'Message sent successfully! I\'ll get back to you soon.';
const UNAVAILABLE = 'The contact form is temporarily unavailable. Please reach out on LinkedIn instead.';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Behind Cloudflare the visitor address is in CF-Connecting-IP.
export function clientIp(request) {
  return (request.headers.get('CF-Connecting-IP') || '').trim() || 'unknown';
}

async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { tooLarge: true };
  try {
    const body = JSON.parse(text);
    return { body: body && typeof body === 'object' ? body : {} };
  } catch {
    return { body: {} };
  }
}

async function lastSubmissionAt(db, ip) {
  const row = await db
    .prepare('SELECT submitted_at FROM messages WHERE ip = ? ORDER BY submitted_at DESC LIMIT 1')
    .bind(ip)
    .first();
  return row ? Number(row.submitted_at) : null;
}

export async function handleContact(request, env, { fetchImpl = fetch, now = Date.now } = {}) {
  if (request.method !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  const { body, tooLarge } = await readJson(request);
  if (tooLarge) return json(413, { message: 'Input exceeds maximum length' });

  const { name, subject, message, website, turnstileToken, formStartTime } = body;
  const fields = { name, subject, message };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== 'string' || value.trim() === '') {
      return json(400, { message: 'Name, subject, and message are required' });
    }
    if (value.length > LIMITS[key]) {
      return json(400, { message: 'Input exceeds maximum length' });
    }
  }

  // Honeypot: hidden from people, filled in by naive bots. Answer like a success so bots learn nothing.
  if (typeof website === 'string' && website.trim() !== '') {
    return json(201, { message: SUCCESS });
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) {
    console.error('Contact form: TURNSTILE_SECRET_KEY, CONTACT_TO or CONTACT_FROM is not set; rejecting submissions.');
    return json(503, { message: UNAVAILABLE });
  }

  const ip = clientIp(request);
  const receivedAt = now();

  let last;
  try {
    last = await lastSubmissionAt(env.DB, ip);
  } catch (error) {
    // Without the cooldown lookup the form still works; Turnstile still gates it.
    console.error('Contact form: cooldown lookup failed:', error.message);
    last = null;
  }
  if (last !== null && receivedAt - last < COOLDOWN_MS) {
    return json(429, { message: 'Please wait a few seconds before sending another message.' });
  }

  const verification = await verifyTurnstileToken(turnstileToken, ip, {
    secret: env.TURNSTILE_SECRET_KEY,
    fetchImpl,
  });
  if (!verification.ok) {
    console.warn('Contact form: Turnstile verification failed:', verification.reason);
    return json(400, { message: 'Verification failed. Please complete the check again and resend.' });
  }

  const startedAt = Number(formStartTime);
  const formDuration = Number.isFinite(startedAt) && startedAt > 0 && startedAt <= receivedAt ? receivedAt - startedAt : 0;
  const userAgent = request.headers.get('User-Agent') || '';
  const clean = { name: name.trim(), subject: subject.trim(), message: message.trim() };

  // Store first, so a mail failure never loses the message.
  let id = null;
  try {
    const result = await env.DB
      .prepare('INSERT INTO messages (name, subject, message, ip, user_agent, form_duration_ms, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(clean.name, clean.subject, clean.message, ip, userAgent, formDuration, receivedAt)
      .run();
    id = result.meta.last_row_id;
  } catch (error) {
    console.error('Contact form: D1 insert failed:', error.message);
  }

  const emailFields = { ...clean, ip, userAgent, formDuration, receivedAt };
  let emailError = null;
  try {
    await env.EMAIL.send({
      from: { email: env.CONTACT_FROM, name: 'Portfolio contact form' },
      to: env.CONTACT_TO,
      subject: buildEmailSubject(clean.subject),
      html: buildEmailHtml(emailFields),
      text: buildEmailText(emailFields),
    });
  } catch (error) {
    emailError = `${error.code || error.name}: ${error.message}`;
    console.error(`Contact form: email notification failed for message ${id}:`, emailError);
  }

  if (id === null && emailError) {
    return json(500, { message: 'Failed to send message. Please try again.' });
  }

  if (id !== null) {
    try {
      await env.DB
        .prepare('UPDATE messages SET email_status = ?, email_error = ? WHERE id = ?')
        .bind(emailError ? 'failed' : 'sent', emailError, id)
        .run();
    } catch (error) {
      console.error(`Contact form: could not record email status for message ${id}:`, error.message);
    }
  }

  return json(201, id === null ? { message: SUCCESS } : { message: SUCCESS, id });
}
