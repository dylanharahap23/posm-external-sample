'use client';
import { FormEvent, useState } from 'react';
export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
    if (!response.ok) { setError((await response.json()).error || 'Sign in failed'); setBusy(false); return; }
    window.location.reload();
  }
  return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">PANAKO INTELLIGENCE</div><h1>Sign in</h1><p>This deployment is a single-admin pilot. Access is protected by server-side authentication.</p><form onSubmit={submit}><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required /><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /><button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>{error && <p role="alert">{error}</p>}</form></section></main>;
}
