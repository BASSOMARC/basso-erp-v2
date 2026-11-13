'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, todas } from '@/lib/supabase';
import { cargarMargen, Jm } from '@/lib/margen';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const f2 = (n: number) => n.toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const eur = (n: number) => n.toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
const col = (n: number) => (n < 0 ? 'var(--r)' : 'var(--ok)');

function Dinero() {
  const [m, setM] = useState<{ js: Jm[]; sinCoste: number; sinTarifa: number } | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const hoy = new Date(); const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1); const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const desde = new Date(Math.min(ini.getTime(), hoy.getTime() - 13 * 864e5));
    try { setM(await cargarMargen(iso(new Date(desde.getTime() - desde.getTimezoneOffset() * 6e4)), iso(new Date(fin.getTime() - fin.getTimezoneOffset() * 6e4)))); } catch (e: any) { setErr(e.message); }
  })(); }, []);
  if (err) return <div className="msg err">Dinero: {err}</div>;
  if (!m) return <div className="muted">Calculando márgenes…</div>;
  const hoyS = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const mesS = hoyS.slice(0, 7);
  const fact = m.js.filter(j => !j.nf); const ferm = m.js.filter(j => j.nf);
  const sum = (a: Jm[], k: 'ingreso' | 'coste') => a.reduce((s, j) => s + j[k], 0);
  const dia = (f: string) => { const a = fact.filter(j => j.fecha === f); return { i: sum(a, 'ingreso'), c: sum(a, 'coste'), n: a.length }; };
  const hoyD = dia(hoyS); const mesA = fact.filter(j => j.fecha.startsWith(mesS)); const mesI = sum(mesA, 'ingreso'), mesC = sum(mesA, 'coste');
  const fermC = sum(ferm.filter(j => j.fecha.startsWith(mesS)), 'coste');
  const ultimos = Array.from({ length: 14 }, (_, i) => { const f = new Date(new Date(hoyS + 'T12:00').getTime() - (13 - i) * 864e5).toISOString().slice(0, 10); const d = dia(f); return { f, mg: d.i - d.c, n: d.n }; });
  const maxA = Math.max(1, ...ultimos.map(u => Math.abs(u.mg)));
  const lista = fact.filter(j => j.fecha >= ultimos[0].f).slice(0, 40);
  const pierde = lista.filter(j => !j.sinTarifa && j.ingreso - j.coste < 0).length;
  return (<>
    <h3 style={{ margin: '18px 0 8px' }}>Dinero · lo que ganamos</h3>
    {(m.sinTarifa > 0 || m.sinCoste > 0) && <div className="msg err">Faltan datos: {m.sinTarifa > 0 && <>{m.sinTarifa} jornada(s) sin tarifa de venta (cuentan 0 €). </>}{m.sinCoste > 0 && <>{m.sinCoste} línea(s) sin coste por hora. </>}<Link href="/costes" style={{ color: 'inherit', fontWeight: 600 }}>Completar en Costes y tarifas →</Link></div>}
    <div className="kpis">
      <div className="kpi"><div className="kn" style={{ color: col(hoyD.i - hoyD.c) }}>{hoyD.n ? eur(hoyD.i - hoyD.c) : '—'}</div><div className="kl">Margen de hoy{hoyD.n ? ` · factura ${eur(hoyD.i)}` : ' (sin jornadas fichadas)'}</div></div>
      <div className="kpi"><div className="kn" style={{ color: col(mesI - mesC) }}>{eur(mesI - mesC)}</div><div className="kl">Margen del mes{mesI > 0 ? ` · ${Math.round((mesI - mesC) / mesI * 100)} %` : ''}</div></div>
      <div className="kpi"><div className="kn">{eur(mesI)}</div><div className="kl">A facturar este mes</div></div>
      <div className="kpi"><div className="kn">{eur(mesC)}</div><div className="kl">Coste mano de obra (clientes que se facturan)</div></div>
      <div className="kpi"><div className="kn">{eur(fermC)}</div><div className="kl">Coste fermages (se recupera con la uva)</div></div>
    </div>
    <div className="card"><h3>Margen por día · últimos 14 días</h3>
      <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
        {ultimos.map(u => (<div key={u.f} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
          <div style={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{u.mg > 0 && <div title={eur(u.mg)} style={{ width: '70%', height: Math.max(3, u.mg / maxA * 56), background: 'var(--ok)', borderRadius: 3 }} />}</div>
          <div style={{ borderTop: '1px solid var(--border2)', height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>{u.mg < 0 && <div title={eur(u.mg)} style={{ width: '70%', height: Math.max(3, -u.mg / maxA * 56), background: 'var(--r)', borderRadius: 3 }} />}</div>
          <div style={{ color: u.mg < 0 ? 'var(--r)' : 'var(--text2)', fontWeight: 600 }}>{u.n ? Math.round(u.mg) : ''}</div><div className="muted" style={{ fontSize: 10 }}>{u.f.slice(8)}/{u.f.slice(5, 7)}</div></div>))}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>Verde = ganamos · rojo = perdemos. Cuenta jornadas fichadas o validadas de clientes que se facturan (sin fermages).</div>
    </div>
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>Margen por jornada{pierde ? ` · ${pierde} en pérdida` : ''}</h3>
      {lista.length === 0 ? <div className="muted">Aún no hay jornadas fichadas en estos días.</div> :
        <table style={{ whiteSpace: 'nowrap' }}><thead><tr><th>Día</th><th>Cliente · servicio</th><th>Horas</th><th>Cepas/kg</th><th>Ingreso</th><th>Coste</th><th>Margen</th><th>Ingreso/h</th></tr></thead>
          <tbody>{lista.map(j => { const mg = j.ingreso - j.coste; return (<tr key={j.id}>
            <td>{j.fecha.slice(8)}/{j.fecha.slice(5, 7)}</td><td>{j.cliente}<div className="muted">{j.servicio}{j.modalidad !== 'hora' ? ' · por ' + j.modalidad : ''}{j.estado === 'fichada' ? ' · sin validar' : ''}</div></td>
            <td>{Math.round(j.horas * 10) / 10}</td><td>{j.cantidad ? j.cantidad.toLocaleString(loc()) : '—'}</td>
            <td>{j.sinTarifa ? <span style={{ color: 'var(--r)' }}>sin tarifa</span> : eur(j.ingreso)}</td><td>{eur(j.coste)}</td>
            <td style={{ color: j.sinTarifa ? 'var(--text2)' : col(mg), fontWeight: 700 }}>{j.sinTarifa ? '—' : eur(mg)}</td>
            <td>{j.horas > 0 && !j.sinTarifa ? (Math.round(j.ingreso / j.horas * 100) / 100).toLocaleString(loc()) + ' €' : '—'}</td></tr>); })}</tbody></table>}
    </div>
  </>);
}

function Contenido({ admin }: { admin: boolean }) {
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
    setD({ horas, trabs, porteurs, pend: pendQ.count || 0, inc: incQ.count || 0, clientes: Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 8), dias7, mes: ini.toLocaleString(loc(), { month: 'long', year: 'numeric' }) });
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
    {admin && <Dinero />}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido admin={p.rol === 'admin'} />}</Shell>; }
