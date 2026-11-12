'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { LOGO } from '@/lib/Shell';
export default function Login() {
  const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) { setErr('Usuario o contraseña incorrectos'); return; }
    router.replace('/');
  }
  return (<div className="login-page"><form className="login-box" onSubmit={entrar}>
    <div className="login-logo"><img src={LOGO} alt="Basso" /></div>
    <div className="login-title">Basso Services Viticoles</div>
    <div className="login-sub">Acceso al sistema</div>
    {err && <div className="msg err">{err}</div>}
    <div style={{ marginBottom: 10 }}><label>Correo</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></div>
    <div style={{ marginBottom: 14 }}><label>Contraseña</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" required /></div>
    <button className="btn btn-g" style={{ width: '100%', padding: 10 }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
  </form></div>);
}
