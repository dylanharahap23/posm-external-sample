import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { authorize, createSession, isProductionAuthConfigured, sessionActor, SESSION_TTL, verifyPassword } from '../lib/auth';

const password = 'correct horse battery staple';
const hash = () => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
};

test('scrypt password hashes verify without accepting malformed or wrong values', () => {
  const encoded = hash();
  assert.equal(verifyPassword(password, encoded), true);
  assert.equal(verifyPassword('wrong', encoded), false);
  assert.equal(verifyPassword(password, 'not-a-scrypt-hash'), false);
});

test('production authorization accepts only a valid signed session cookie', () => {
  const env = { NODE_ENV: 'production', PANAKO_AUTH_SECRET: 'a'.repeat(32), PANAKO_ADMIN_USERNAME: 'admin', PANAKO_ADMIN_PASSWORD_HASH: hash() };
  assert.equal(isProductionAuthConfigured(env), true);
  assert.throws(() => authorize(new Request('https://panako.example/api/data'), env));
  const session = createSession(env);
  const actor = authorize(new Request('https://panako.example/api/data', { headers: { cookie: `panako_session=${session}` } }), env);
  assert.deepEqual(actor, { id: 'admin', role: 'admin' });
  assert.throws(() => authorize(new Request('https://panako.example/api/data', { headers: { cookie: `panako_session=${session}.tampered` } }), env));
});

test('local mode rejects all forwarded headers and stays loopback-only', () => {
  const env = { PANAKO_LOCAL_MODE: 'true', NODE_ENV: 'development' };
  assert.equal(authorize(new Request('http://localhost:3000/api/data'), env).role, 'admin');
  assert.throws(() => authorize(new Request('http://localhost:3000/api/data', { headers: { 'x-forwarded-host': 'localhost' } }), env));
  assert.throws(() => authorize(new Request('http://localhost:3000/api/data', { headers: { forwarded: 'for=127.0.0.1;host=localhost' } }), env));
});

test('login endpoint sets secure httpOnly same-site cookie and logout clears it', async () => {
  Object.assign(process.env, { NODE_ENV: 'production' });
  process.env.PANAKO_AUTH_SECRET = 'b'.repeat(32);
  process.env.PANAKO_ADMIN_USERNAME = 'admin';
  process.env.PANAKO_ADMIN_PASSWORD_HASH = hash();
  const { POST, DELETE } = await import('../app/api/auth/route');
  const response = await POST(new Request('https://panako.example/api/auth', { method: 'POST', headers: { origin: 'https://panako.example' }, body: JSON.stringify({ username: 'admin', password }) }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /panako_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const cleared = await DELETE(new Request('https://panako.example/api/auth', { method: 'DELETE', headers: { origin: 'https://panako.example' } }));
  assert.equal(cleared.status, 200);
  assert.match(cleared.headers.get('set-cookie')!, /Max-Age=0/);
});

test('sessions expire and rotate with configured credentials; mutations reject forwarded origin spoof', () => {
  const env = { NODE_ENV: 'production', PANAKO_AUTH_SECRET: 'c'.repeat(32), PANAKO_ADMIN_USERNAME: 'admin', PANAKO_ADMIN_PASSWORD_HASH: hash(), PANAKO_PUBLIC_ORIGIN: 'https://panako.example' };
  const token = createSession(env, 100000);
  assert.equal(sessionActor(token, env, 100000 + SESSION_TTL * 1000), null);
  assert.equal(sessionActor(token, { ...env, PANAKO_ADMIN_PASSWORD_HASH: hash() }, 100000), null);
  assert.throws(() => authorize(new Request('https://panako.example/api/data', { method: 'POST', headers: { cookie: `panako_session=${createSession(env)}`, origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' } }), env));
});

test('rate limiting cannot be bypassed by rotating forwarded headers', async () => {
  const { POST } = await import('../app/api/auth/route');
  const request = (origin: string, n: number) => new Request('https://panako.example/api/auth', { method: 'POST', headers: { origin, 'x-forwarded-for': `192.0.2.${n}` }, body: JSON.stringify({ username: 'admin', password: 'wrong' }) });
  assert.equal((await POST(request('https://evil.example', 1))).status, 403);
  for (let n = 0; n < 9; n++) assert.equal((await POST(request('https://panako.example', n))).status, 401);
  const blocked = await POST(request('https://panako.example', 50));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
});

test('login UI has accessible credentials and pilot disclosure without operational workspace', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Login } = await import('../components/login');
  const html = renderToStaticMarkup(React.createElement(Login));
  assert.match(html, /Username/);
  assert.match(html, /type="password"/);
  assert.match(html, /single-admin pilot/i);
  assert.doesNotMatch(html, /Store directory/);
});
