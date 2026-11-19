// Cloudflare Turnstile server-side validation.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's documented test secret: always passes. Only used outside production.
const TEST_SECRET = '1x0000000000000000000000000000000AA';
const EXPECTED_HOSTNAME = 'tanmaynargas.com';
const EXPECTED_ACTION = 'contact';

function getTurnstileSecret(env = process.env) {
  if (env.TURNSTILE_SECRET_KEY) return env.TURNSTILE_SECRET_KEY;
  return env.NODE_ENV === 'production' ? null : TEST_SECRET;
}

// Returns { ok, reason }. Never throws; network failures fail closed.
async function verifyTurnstileToken(token, remoteIp, { env = process.env, fetchImpl = fetch } = {}) {
  const secret = getTurnstileSecret(env);
  if (!secret) return { ok: false, reason: 'missing-secret' };
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: 'missing-token' };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.append('remoteip', remoteIp);

  let result;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(8000) });
    result = await response.json();
  } catch (error) {
    return { ok: false, reason: 'siteverify-unreachable' };
  }

  if (!result || result.success !== true) {
    return { ok: false, reason: (result && result['error-codes'] || ['failed']).join(',') };
  }

  // Test keys report example.com and no action, so these checks only apply to the real widget.
  if (env.NODE_ENV === 'production') {
    if (result.hostname !== EXPECTED_HOSTNAME) return { ok: false, reason: `hostname:${result.hostname}` };
    if (result.action !== EXPECTED_ACTION) return { ok: false, reason: `action:${result.action}` };
  }

  return { ok: true, reason: null };
}

module.exports = { verifyTurnstileToken, getTurnstileSecret, EXPECTED_ACTION };
