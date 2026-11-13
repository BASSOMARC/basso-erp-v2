'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { sb, Perfil } from './supabase';
import { useT, aplicarIdioma, cambiarIdioma, tr } from './i18n';
export const LOGO = 'https://i.postimg.cc/bvDHmp47/WhatsApp-Image-2026-05-14-at-17-24-20-(6).jpg';
const NAV: Record<string, [string, string, string?][]> = {
  admin: [['/dashboard', 'Resumen'], ['/calendario', 'Calendario'], ['/planificar', 'Planificar'], ['/fichaje', 'Fichaje'], ['/validar', 'Validar'], ['/horas', 'Control de horas'],
    ['/incidencias', 'Incidencias', 'Equipo y clientes'], ['/clientes', 'Clientes', 'Equipo y clientes'], ['/trabajadores', 'Trabajadores', 'Equipo y clientes'], ['/proyectos', 'Proyectos', 'Equipo y clientes'], ['/bitacora', 'Bitácora', 'Equipo y clientes'],
    ['/costes', 'Costes y tarifas', 'Dinero'], ['/rentabilidad', 'Rentabilidad', 'Dinero']],
  secretaria: [['/dashboard', 'Resumen'], ['/calendario', 'Calendario'], ['/planificar', 'Planificar'], ['/horas', 'Horas'], ['/incidencias', 'Incidencias'], ['/clientes', 'Clientes', 'Gestión'], ['/trabajadores', 'Trabajadores', 'Gestión'], ['/proyectos', 'Proyectos', 'Gestión'], ['/bitacora', 'Bitácora', 'Gestión']],
  jefe: [['/fichaje', 'Mis jornadas']],
  cliente: [['/portal', 'Espace client']],
};
export default function Shell({ roles, children }: { roles: string[]; children: (p: Perfil) => React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [err, setErr] = useState('');
  const router = useRouter(); const path = usePathname();
  const { lang, t: t0 } = useT();
  const t = (k: string) => (perfil && perfil.rol !== 'jefe' && perfil.rol !== 'cliente') ? tr('es', k) : t0(k);
  const fr = perfil?.rol === 'cliente' || (perfil?.rol === 'jefe' && lang === 'fr');
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data, error } = await sb.from('perfiles').select('*').eq('user_id', session.user.id).maybeSingle();
      if (error || !data || data.activo === false) { setErr(t('noPerm')); return; }
      if (!roles.includes(data.rol)) { router.replace('/'); return; }
      if (data.rol === 'cliente') aplicarIdioma('fr'); else if ((data as any).idioma === 'fr' || (data as any).idioma === 'es') aplicarIdioma((data as any).idioma);
      setPerfil(data as Perfil);
    })();
  }, []);
  if (err) return <div className="content"><div className="msg err">{err}</div><button className="btn" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>{t('logout')}</button></div>;
  if (!perfil) return <div className="content muted">{t('loading')}</div>;
  return (<>
    <div className="topbar">
      <div className="brand"><img src={LOGO} alt="Basso" /> Basso Services Viticoles</div>
      <div className="nav">
        {(NAV[perfil.rol] || []).filter(x => !x[2]).map(([h, tx]) => <Link key={h} href={h} className={path === h ? 'active' : ''}>{perfil.rol === 'jefe' ? t('myDays') : tx}</Link>)}
        {Array.from(new Set((NAV[perfil.rol] || []).filter(x => x[2]).map(x => x[2]!))).map(g => {
          const items = (NAV[perfil.rol] || []).filter(x => x[2] === g); const act = items.some(x => x[0] === path);
          return (<details key={g + path} className={'navg' + (act ? ' active' : '')}><summary>{g} ▾</summary><div className="navmenu">{items.map(([h, tx]) => <Link key={h} href={h} className={path === h ? 'active' : ''}>{tx}</Link>)}</div></details>);
        })}
      </div>
      <div className="who">{(perfil.rol === 'jefe' || path.startsWith('/fichaje')) && <span className="lang"><button className={lang === 'es' ? 'on' : ''} onClick={() => cambiarIdioma('es')}>ES</button><button className={lang === 'fr' ? 'on' : ''} onClick={() => cambiarIdioma('fr')}>FR</button></span>}{perfil.nombre}{fr ? '' : ' · ' + perfil.rol}<button className="btn" onClick={async () => { const n = prompt(t('pwdPrompt')); if (!n) return; if (n.length < 10) { alert(t('pwdShort')); return; } const { error } = await sb.auth.updateUser({ password: n }); alert(error ? t('pwdFail') + error.message : t('pwdOk')); }}>{t('changePwd')}</button><button className="btn" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>{t('logout')}</button></div>
    </div>
    <div className="content">{children(perfil)}</div>
  </>);
}
