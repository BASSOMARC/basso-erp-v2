'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { sb, Perfil } from './supabase';
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
  const fr = perfil?.rol === 'cliente';
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data, error } = await sb.from('perfiles').select('*').eq('user_id', session.user.id).maybeSingle();
      if (error || !data || data.activo === false) { setErr('Tu usuario no tiene permisos. Habla con un administrador.'); return; }
      if (!roles.includes(data.rol)) { router.replace('/'); return; }
      setPerfil(data as Perfil);
    })();
  }, []);
  if (err) return <div className="content"><div className="msg err">{err}</div><button className="btn" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>Salir</button></div>;
  if (!perfil) return <div className="content muted">Cargando…</div>;
  return (<>
    <div className="topbar">
      <div className="brand"><img src={LOGO} alt="Basso" /> Basso Services Viticoles</div>
      <div className="nav">
        {(NAV[perfil.rol] || []).filter(x => !x[2]).map(([h, t]) => <Link key={h} href={h} className={path === h ? 'active' : ''}>{t}</Link>)}
        {Array.from(new Set((NAV[perfil.rol] || []).filter(x => x[2]).map(x => x[2]!))).map(g => {
          const items = (NAV[perfil.rol] || []).filter(x => x[2] === g); const act = items.some(x => x[0] === path);
          return (<details key={g + path} className={'navg' + (act ? ' active' : '')}><summary>{g} ▾</summary><div className="navmenu">{items.map(([h, t]) => <Link key={h} href={h} className={path === h ? 'active' : ''}>{t}</Link>)}</div></details>);
        })}
      </div>
      <div className="who">{perfil.nombre}{fr ? '' : ' · ' + perfil.rol}<button className="btn" onClick={async () => { const n = prompt(fr ? 'Nouveau mot de passe (10 caractères minimum) :' : 'Nueva contraseña (mínimo 10 caracteres):'); if (!n) return; if (n.length < 10) { alert(fr ? 'Trop court' : 'Demasiado corta'); return; } const { error } = await sb.auth.updateUser({ password: n }); alert(error ? (fr ? 'Échec : ' : 'No se pudo cambiar: ') + error.message : (fr ? 'Mot de passe modifié ✔' : 'Contraseña cambiada ✔')); }}>{fr ? 'Changer le mot de passe' : 'Cambiar contraseña'}</button><button className="btn" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>{fr ? 'Déconnexion' : 'Salir'}</button></div>
    </div>
    <div className="content">{children(perfil)}</div>
  </>);
}
