import { assertSameOrigin, authorize, createSession, credentialsMatch, HttpError, sessionCookie } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Single-instance pilot: a global bucket cannot be bypassed by spoofing forwarded IPs.
// Restarting the process resets the bucket. Add an edge limit before multi-instance use.
let attempts = 0;
let windowEnds = 0;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  return Response.json({ error: error instanceof HttpError ? error.message : 'Authentication service unavailable' }, { status: error instanceof HttpError ? error.status : 503, headers });
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request, process.env, true);
    const now = Date.now();
    if (now >= windowEnds) { attempts = 0; windowEnds = now + WINDOW_MS; }
    if (attempts >= MAX_ATTEMPTS) return Response.json({ error: 'Too many login attempts; try again later' }, { status: 429, headers: { ...headers, 'Retry-After': String(Math.ceil((windowEnds - now) / 1000)) } });
    attempts++;
    const text = await request.text();
    if (text.length > 4096) throw new HttpError(413, 'Request too large');
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new HttpError(400, 'Invalid login request'); }
    if (!body || typeof body !== 'object' || !('username' in body) || !('password' in body) || typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 128 || body.password.length > 1024) throw new HttpError(400, 'Invalid login request');
    if (!credentialsMatch(body.username, body.password)) throw new HttpError(401, 'Invalid username or password');
    return Response.json({ ok: true }, { headers: { ...headers, 'Set-Cookie': sessionCookie(createSession()) } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request, process.env, true);
    return Response.json({ ok: true }, { headers: { ...headers, 'Set-Cookie': sessionCookie('', process.env, true) } });
  } catch (error) { return failure(error); }
}
export async function GET(request: Request) {
  try { return Response.json({ actor: authorize(request) }, { headers }); }
  catch (error) { return failure(error); }
}
