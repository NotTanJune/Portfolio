import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { handleContact, COOLDOWN_MS } from '../src/contact.js';
import { verifyTurnstileToken, TEST_SECRET } from '../src/turnstile.js';
import { escapeHtml, buildEmailHtml } from '../src/email.js';
import worker from '../src/index.js';

const MIGRATION = readFileSync(new URL('../migrations/0001_create_messages.sql', import.meta.url), 'utf8');

// Minimal D1 stand-in over SQLite, running the real migration.
function fakeD1({ failInsert = false, failSelect = false } = {}) {
  const sqlite = new Database(':memory:');
  sqlite.exec(MIGRATION);
  return {
    sqlite,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (failSelect) throw new Error('select down');
              return sqlite.query(sql).get(...params) ?? null;
            },
            async run() {
              if (failInsert && sql.startsWith('INSERT')) throw new Error('insert down');
              const info = sqlite.query(sql).run(...params);
              return { meta: { last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
  };
}

function fakeEmail({ fail = false } = {}) {
  const sent = [];
  return {
    sent,
    async send(message) {
      if (fail) throw Object.assign(new Error('not verified'), { code: 'E_RECIPIENT_PLAN_RESTRICTED' });
      sent.push(message);
      return { messageId: 'm1' };
    },
  };
}

function makeEnv(overrides = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'real-secret',
    CONTACT_TO: 'owner@example.com',
    CONTACT_FROM: 'contact@tanmaynargas.com',
    DB: fakeD1(),
    EMAIL: fakeEmail(),
    ...overrides,
  };
}

const passTurnstile = async () => ({ json: async () => ({ success: true, hostname: 'tanmaynargas.com', action: 'contact' }) });
const failTurnstile = async () => ({ json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) });

function post(body, { ip = '203.0.113.7', headers = {} } = {}) {
  return new Request('https://tanmaynargas.com/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, 'User-Agent': 'test-agent', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const valid = { name: 'Ada', subject: 'Hello', message: 'Line one\nLine two', website: '', turnstileToken: 'tok', formStartTime: 1_000 };

async function call(request, env, opts = {}) {
  const response = await handleContact(request, env, { fetchImpl: passTurnstile, now: () => 60_000, ...opts });
  return { status: response.status, body: await response.json() };
}

describe('handleContact', () => {
  test('stores the message, emails the owner and returns 201', async () => {
    const env = makeEnv();
    const { status, body } = await call(post(valid), env);
    expect(status).toBe(201);
    expect(body.id).toBe(1);

    const row = env.DB.sqlite.query('SELECT * FROM messages').get();
    expect(row).toMatchObject({ name: 'Ada', subject: 'Hello', ip: '203.0.113.7', user_agent: 'test-agent', form_duration_ms: 59_000, submitted_at: 60_000, email_status: 'sent' });

    const [mail] = env.EMAIL.sent;
    expect(mail.to).toBe('owner@example.com');
    expect(mail.from).toEqual({ email: 'contact@tanmaynargas.com', name: 'Portfolio contact form' });
    expect(mail.subject).toBe('Portfolio Contact: Hello');
    expect(mail.html).toContain('Line one<br>Line two');
    expect(mail.text).toContain('Line one\nLine two');
  });

  test('rejects missing and oversized fields', async () => {
    expect((await call(post({ ...valid, name: '  ' }), makeEnv())).status).toBe(400);
    expect((await call(post({ ...valid, message: 'x'.repeat(2001) }), makeEnv())).status).toBe(400);
    expect((await call(post('not json'), makeEnv())).status).toBe(400);
    expect((await call(post('x'.repeat(20_000)), makeEnv())).status).toBe(413);
  });

  test('answers the honeypot like a success without storing or sending', async () => {
    const env = makeEnv();
    const { status } = await call(post({ ...valid, website: 'spam.example' }), env);
    expect(status).toBe(201);
    expect(env.DB.sqlite.query('SELECT COUNT(*) AS n FROM messages').get().n).toBe(0);
    expect(env.EMAIL.sent).toHaveLength(0);
  });

  test('enforces the 30 second per-IP cooldown', async () => {
    const env = makeEnv();
    expect((await call(post(valid), env, { now: () => 60_000 })).status).toBe(201);
    expect((await call(post(valid), env, { now: () => 60_000 + COOLDOWN_MS - 1 })).status).toBe(429);
    expect((await call(post(valid, { ip: '198.51.100.1' }), env, { now: () => 61_000 })).status).toBe(201);
    expect((await call(post(valid), env, { now: () => 60_000 + COOLDOWN_MS })).status).toBe(201);
  });

  test('a failed cooldown lookup does not block the form', async () => {
    const env = makeEnv({ DB: fakeD1({ failSelect: true }) });
    expect((await call(post(valid), env)).status).toBe(201);
  });

  test('a failed Turnstile check returns 400 and does not start a cooldown', async () => {
    const env = makeEnv();
    expect((await call(post(valid), env, { fetchImpl: failTurnstile })).status).toBe(400);
    expect((await call(post(valid), env, { now: () => 61_000 })).status).toBe(201);
  });

  test('fails closed with 503 when a secret is missing', async () => {
    expect((await call(post(valid), makeEnv({ TURNSTILE_SECRET_KEY: undefined }))).status).toBe(503);
    expect((await call(post(valid), makeEnv({ CONTACT_TO: undefined }))).status).toBe(503);
  });

  test('a mail failure keeps the stored message and still returns 201', async () => {
    const env = makeEnv({ EMAIL: fakeEmail({ fail: true }) });
    const { status } = await call(post(valid), env);
    expect(status).toBe(201);
    const row = env.DB.sqlite.query('SELECT email_status, email_error FROM messages').get();
    expect(row.email_status).toBe('failed');
    expect(row.email_error).toContain('E_RECIPIENT_PLAN_RESTRICTED');
  });

  test('a D1 insert failure still emails and returns 201', async () => {
    const env = makeEnv({ DB: fakeD1({ failInsert: true }) });
    const { status, body } = await call(post(valid), env);
    expect(status).toBe(201);
    expect(body.id).toBeUndefined();
    expect(env.EMAIL.sent).toHaveLength(1);
  });

  test('returns 500 only when both storage and mail fail', async () => {
    const env = makeEnv({ DB: fakeD1({ failInsert: true }), EMAIL: fakeEmail({ fail: true }) });
    expect((await call(post(valid), env)).status).toBe(500);
  });

  test('rejects other methods', async () => {
    const response = await handleContact(new Request('https://tanmaynargas.com/api/contact'), makeEnv());
    expect(response.status).toBe(405);
  });
});

describe('verifyTurnstileToken', () => {
  test('forwards secret and visitor IP to siteverify', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, body: init.body.toString() }); return passTurnstile(); };
    expect(await verifyTurnstileToken('tok', '203.0.113.7', { secret: 'real-secret', fetchImpl })).toEqual({ ok: true, reason: null });
    expect(calls[0].url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(calls[0].body).toContain('remoteip=203.0.113.7');
  });

  test('rejects another hostname or action with the real secret', async () => {
    const fetchImpl = async () => ({ json: async () => ({ success: true, hostname: 'evil.example', action: 'contact' }) });
    expect((await verifyTurnstileToken('tok', null, { secret: 'real-secret', fetchImpl })).ok).toBe(false);
    const wrongAction = async () => ({ json: async () => ({ success: true, hostname: 'tanmaynargas.com', action: 'login' }) });
    expect((await verifyTurnstileToken('tok', null, { secret: 'real-secret', fetchImpl: wrongAction })).ok).toBe(false);
  });

  test('skips hostname checks only for the test secret', async () => {
    const fetchImpl = async () => ({ json: async () => ({ success: true, hostname: 'example.com' }) });
    expect((await verifyTurnstileToken('tok', null, { secret: TEST_SECRET, fetchImpl })).ok).toBe(true);
  });

  test('fails closed without a secret, without a token, or when unreachable', async () => {
    expect(await verifyTurnstileToken('tok', null, {})).toEqual({ ok: false, reason: 'missing-secret' });
    expect((await verifyTurnstileToken('', null, { secret: 's' })).reason).toBe('missing-token');
    const down = async () => { throw new Error('down'); };
    expect((await verifyTurnstileToken('tok', null, { secret: 's', fetchImpl: down })).reason).toBe('siteverify-unreachable');
  });
});

describe('email', () => {
  test('escapes visitor input in the HTML', () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
    const html = buildEmailHtml({ name: '<b>', subject: '<i>', message: '<img>', ip: '1', userAgent: '<u>', formDuration: 0, receivedAt: 0 });
    expect(html).not.toMatch(/<(b|i|img|u)>/);
  });
});

describe('router', () => {
  test('serves only /api/contact', async () => {
    const response = await worker.fetch(new Request('https://tanmaynargas.com/api/other'), makeEnv());
    expect(response.status).toBe(404);
  });
});
