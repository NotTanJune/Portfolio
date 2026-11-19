const { describe, expect, test } = require('bun:test');
const { verifyTurnstileToken, getTurnstileSecret } = require('./turnstile');
const { clientIp } = require('./client-ip');
const { escapeHtml } = require('./routes/contact');

function fakeFetch(result, calls = []) {
  return async (url, init) => {
    calls.push({ url, body: init.body.toString() });
    return { json: async () => result };
  };
}

const production = { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'real-secret' };

describe('getTurnstileSecret', () => {
  test('uses the configured secret', () => {
    expect(getTurnstileSecret(production)).toBe('real-secret');
  });

  test('falls back to the Cloudflare test secret outside production', () => {
    expect(getTurnstileSecret({ NODE_ENV: 'development' })).toBe('1x0000000000000000000000000000000AA');
  });

  test('has no secret in production when none is configured', () => {
    expect(getTurnstileSecret({ NODE_ENV: 'production' })).toBeNull();
  });
});

describe('verifyTurnstileToken', () => {
  test('accepts a valid production token and forwards the visitor IP', async () => {
    const calls = [];
    const result = await verifyTurnstileToken('token', '203.0.113.7', {
      env: production,
      fetchImpl: fakeFetch({ success: true, hostname: 'tanmaynargas.com', action: 'contact' }, calls),
    });
    expect(result).toEqual({ ok: true, reason: null });
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(calls[0].body).toContain('remoteip=203.0.113.7');
    expect(calls[0].body).toContain('secret=real-secret');
  });

  test('fails closed when production has no secret', async () => {
    const result = await verifyTurnstileToken('token', null, { env: { NODE_ENV: 'production' } });
    expect(result).toEqual({ ok: false, reason: 'missing-secret' });
  });

  test('rejects a missing token without calling Cloudflare', async () => {
    const calls = [];
    const result = await verifyTurnstileToken('', null, { env: production, fetchImpl: fakeFetch({}, calls) });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test('reports Cloudflare error codes', async () => {
    const result = await verifyTurnstileToken('token', null, {
      env: production,
      fetchImpl: fakeFetch({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    });
    expect(result).toEqual({ ok: false, reason: 'timeout-or-duplicate' });
  });

  test('rejects a token issued for another hostname in production', async () => {
    const result = await verifyTurnstileToken('token', null, {
      env: production,
      fetchImpl: fakeFetch({ success: true, hostname: 'evil.example', action: 'contact' }),
    });
    expect(result.ok).toBe(false);
  });

  test('fails closed when siteverify is unreachable', async () => {
    const result = await verifyTurnstileToken('token', null, {
      env: production,
      fetchImpl: async () => { throw new Error('network down'); },
    });
    expect(result).toEqual({ ok: false, reason: 'siteverify-unreachable' });
  });
});

describe('clientIp', () => {
  test('prefers the Cloudflare visitor address over the edge address', () => {
    const req = { ip: '172.70.142.211', get: (h) => (h === 'cf-connecting-ip' ? '119.234.68.185' : undefined) };
    expect(clientIp(req)).toBe('119.234.68.185');
  });

  test('falls back to req.ip without Cloudflare', () => {
    expect(clientIp({ ip: '127.0.0.1', get: () => undefined })).toBe('127.0.0.1');
  });
});

describe('contact email escaping', () => {
  test('escapes HTML in visitor input', () => {
    expect(escapeHtml('<img src=x onerror="a()">')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;');
  });
});
