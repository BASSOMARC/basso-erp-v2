'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { LOGO } from '@/lib/Shell';
import { useT, cambiarIdioma } from '@/lib/i18n';
export default function Login() {
  const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter(); const { t, lang } = useT();
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) { setErr(t('badLogin')); return; }
    await cambiarIdioma(lang);
    router.replace('/');
  }
  return (<div className="login-page"><form className="login-box" onSubmit={entrar}>
    <div style={{ textAlign: 'right' }}><span className="lang dark"><button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => cambiarIdioma('es')}>ES</button><button type="button" className={lang === 'fr' ? 'on' : ''} onClick={() => cambiarIdioma('fr')}>FR</button></span></div>
    <div className="login-logo"><img src={LOGO} alt="Basso" /></div>
    <div className="login-title">Basso Services Viticoles</div>
    <div className="login-sub">{t('loginSub')}</div>
    {err && <div className="msg err">{err}</div>}
    <div style={{ marginBottom: 10 }}><label>{t('email')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></div>
    <div style={{ marginBottom: 14 }}><label>{t('password')}</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" required /></div>
    <button className="btn btn-g" style={{ width: '100%', padding: 10 }} disabled={busy}>{busy ? t('entering') : t('enter')}</button>
  </form></div>);
}
