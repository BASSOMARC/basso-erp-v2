'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/lib/Shell';
import { sb, todas } from '@/lib/supabase';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const f2 = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function Contenido() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const hoy = new Date(); const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1); const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const hace7 = new Date(hoy.getTime() - 6 * 864e5);
    let rows: any[] = []; let pendQ: any; let incQ: any;
    try {
      [rows, pendQ, incQ] = await Promise.all([
        todas((x, z) => sb.from('jornada_trabajador').select('horas_normal,horas_extra,ausente,funcion,trabajador_id,jornadas!inner(fecha,estado,tareas(nombre,clientes(nombre)))').is('borrado_en', null).eq('confirmado', true).gte('jornadas.fecha', iso(ini)).lt('jornadas.fecha', iso(fin)).order('id').range(x, z)),
        sb.from('jornadas').select('id', { count: 'exact', head: true }).is('borrado_en', null).eq('estado', 'fichada'),
        sb.from('incidencias').select('id', { count: 'exact', head: true }).is('borrado_en', null).eq('estado', 'abierta'),
      ]);
    } catch (e: any) { setErr(e.message); return; }
    const act = rows.filter((r: any) => !r.ausente);
    const horas = act.reduce((s: number, r: any) => s + Number(r.horas_normal) + Number(r.horas_extra), 0);
    const trabs = new Set(act.map((r: any) => r.trabajador_id)).size;
    const porteurs = act.filter((r: any) => r.funcion === 'porteur').length;
    const porCliente: Record<string, number> = {};
    act.forEach((r: any) => { const c = r.jornadas?.tareas?.clientes?.nombre || '—'; porCliente[c] = (porCliente[c] || 0) + Number(r.horas_normal) + Number(r.horas_extra); });
    const dias7: Record<string, number> = {};
    for (let i = 0; i < 7; i++) dias7[iso(new Date(hace7.getTime() + i * 864e5))] = 0;
    act.forEach((r: any) => { const f = r.jornadas?.fecha; if (f in dias7) dias7[f] += Number(r.horas_normal) + Number(r.horas_extra); });
    setD({ horas, trabs, porteurs, pend: pendQ.count || 0, inc: incQ.count || 0, clientes: Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 8), dias7, mes: ini.toLocaleString('es', { month: 'long', year: 'numeric' }) });
  })(); }, []);
  if (err) return <div className="msg err">{err}</div>;
  if (!d) return <div className="muted">Cargando…</div>;
  const max = Math.max(1, ...Object.values<number>(d.dias7)); const maxC = Math.max(1, ...d.clientes.map((c: any) => c[1]));
  return (<>
    <h2 style={{ marginBottom: 10 }}>Resumen · {d.mes}</h2>
    <div className="kpis">
      <Link href="/validar" className="kpi"><div className="kn">{d.pend}</div><div className="kl">Jornadas por validar</div></Link>
      <Link href="/incidencias" className="kpi"><div className="kn">{d.inc}</div><div className="kl">Incidencias abiertas</div></Link>
      <div className="kpi"><div className="kn">{f2(d.horas)}</div><div className="kl">Horas este mes</div></div>
      <div className="kpi"><div className="kn">{d.trabs}</div><div className="kl">Trabajadores activos</div></div>
      <div className="kpi"><div className="kn">{d.porteurs}</div><div className="kl">Días de porteur (P)</div></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Últimos 7 días (horas)</h3>
        <div className="bars">{Object.entries<number>(d.dias7).map(([f, h]) => <div key={f} className="bcol"><div className="bv">{h ? f2(h) : ''}</div><div className="bar" style={{ height: Math.round(h / max * 90) + 'px' }} /><div className="bl">{f.slice(8)}/{f.slice(5, 7)}</div></div>)}</div>
      </div>
      <div className="card"><h3>Horas por cliente este mes</h3>
        {d.clientes.length === 0 && <div className="muted">Sin horas este mes.</div>}
        {d.clientes.map(([c, h]: any) => <div key={c} className="hrow"><span className="hn">{c}</span><span className="hb"><i style={{ width: (h / maxC * 100) + '%' }} /></span><span className="hv">{f2(h)} h</span></div>)}
      </div>
    </div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
