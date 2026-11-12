'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { sb, Perfil } from './supabase';
export const LOGO = 'https://i.postimg.cc/bvDHmp47/WhatsApp-Image-2026-05-14-at-17-24-20-(6).jpg';
const NAV: Record<string, [string, string][]> = {
  admin: [['/dashboard', 'Resumen'], ['/calendario', 'Calendario'], ['/validar', 'Validar'], ['/horas', 'Control de horas'], ['/bitacora', 'Bitácora'], ['/incidencias', 'Incidencias'], ['/clientes', 'Clientes'], ['/trabajadores', 'Trabajadores'], ['/proyectos', 'Proyectos'], ['/planificar', 'Planificar'], ['/fichaje', 'Fichaje'], ['/costes', 'Costes y tarifas'], ['/rentabilidad', 'Rentabilidad']],
  secretaria: [['/dashboard', 'Resumen'], ['/calendario', 'Calendario'], ['/clientes', 'Clientes'], ['/trabajadores', 'Trabajadores'], ['/proyectos', 'Proyectos'], ['/planificar', 'Planificar'], ['/horas', 'Horas'], ['/bitacora', 'Bitácora'], ['/incidencias', 'Incidencias']],
  jefe: [['/fichaje', 'Mis jornadas']],
  cliente: [],
};
export default function Shell({ roles, children }: { roles: string[]; children: (p: Perfil) => React.ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [err, setErr] = useState('');
  const router = useRouter(); const path = usePathname();
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
      <div className="nav">{(NAV[perfil.rol] || []).map(([h, t]) => <Link key={h} href={h} className={path === h ? 'active' : ''}>{t}</Link>)}</div>
      <div className="who">{perfil.nombre} · {perfil.rol}<button className="btn" onClick={async () => { const n = prompt('Nueva contraseña (mínimo 10 caracteres):'); if (!n) return; if (n.length < 10) { alert('Demasiado corta'); return; } const { error } = await sb.auth.updateUser({ password: n }); alert(error ? 'No se pudo cambiar: ' + error.message : 'Contraseña cambiada ✔'); }}>Cambiar contraseña</button><button className="btn" onClick={async () => { await sb.auth.signOut(); router.replace('/login'); }}>Salir</button></div>
    </div>
    <div className="content">{children(perfil)}</div>
  </>);
}
