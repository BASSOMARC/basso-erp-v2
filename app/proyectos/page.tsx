'use client';
import { useEffect, useState, useCallback, Fragment } from 'react';
import Link from 'next/link';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, todas } from '@/lib/supabase';
const f2 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 });
const UN: Record<string, string> = { cepas: 'cepas', kg: 'kg', porcentaje: '% a criterio del jefe' };

function Barra({ a }: { a: any }) {
  if (!a) return <span className="muted">—</span>;
  const pct = a.pct == null ? null : Number(a.pct); const u = a.unidad === 'porcentaje' ? '' : ' ' + a.unidad;
  return (<div style={{ minWidth: 150 }}>
    {pct !== null ? <><div style={{ background: 'var(--pl)', borderRadius: 6, height: 10, overflow: 'hidden' }}><div style={{ width: Math.min(100, pct) + '%', height: '100%', background: pct > 100 ? 'var(--a)' : 'var(--p)' }} /></div>
      <div style={{ fontWeight: 700 }}>{f2(pct)} %</div></> : <div className="muted">sin objetivo</div>}
    {a.unidad !== 'porcentaje' && <div className="muted">{f2(Number(a.avance))}{a.objetivo ? ' / ' + f2(Number(a.objetivo)) : ''}{u}</div>}
  </div>);
}

function Historial({ p }: { p: any }) {
  const [h, setH] = useState<any[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    try {
      const js = await todas((x, z) => sb.from('jornadas').select('id,fecha,estado,avance_pct,tareas!inner(nombre,proyecto_id),jornada_trabajador(horas_normal,horas_extra,ausente,borrado_en),jornada_cantidad(unidad,cantidad,borrado_en)').eq('tareas.proyecto_id', p.id).is('borrado_en', null).in('estado', ['fichada', 'validada']).order('fecha', { ascending: false }).range(x, z));
      setH(js);
    } catch (e: any) { setErr(e.message); }
  })(); }, [p.id]);
  if (err) return <div className="msg err">{err}</div>;
  if (!h) return <div className="muted">Cargando…</div>;
  if (h.length === 0) return <div className="muted">Aún no hay jornadas fichadas en este proyecto.</div>;
  return (<table><thead><tr><th>Día</th><th>Trabajo</th><th>Estado</th><th>Horas</th><th>Cepas/kg</th>{p.unidad_avance === 'porcentaje' && <th>Avance total</th>}</tr></thead>
    <tbody>{h.map(j => { const hs = (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en && !l.ausente).reduce((s: number, l: any) => s + Number(l.horas_normal) + Number(l.horas_extra), 0); const c = (j.jornada_cantidad || []).find((x: any) => !x.borrado_en);
      return <tr key={j.id}><td>{j.fecha}</td><td>{j.tareas?.nombre}</td><td>{j.estado}</td><td>{f2(hs)} h</td><td>{c ? f2(Number(c.cantidad)) + ' ' + c.unidad : '—'}</td>{p.unidad_avance === 'porcentaje' && <td>{j.avance_pct != null ? f2(Number(j.avance_pct)) + ' %' : '—'}</td>}</tr>; })}</tbody></table>);
}

function Fila({ p, onSaved }: any) {
  const [n, setN] = useState(p.nombre); const [e, setE] = useState(p.estado); const [u, setU] = useState(p.unidad_avance || 'cepas'); const [o, setO] = useState(p.cantidad_objetivo == null ? '' : String(p.cantidad_objetivo));
  const [abre, setAbre] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const objNuevo = u === 'porcentaje' ? null : (o === '' ? null : Number(o));
  const cambiado = n !== p.nombre || e !== p.estado || u !== (p.unidad_avance || 'cepas') || objNuevo !== (p.cantidad_objetivo == null ? null : Number(p.cantidad_objetivo));
  async function guardar() {
    if (!n.trim()) { setMsg({ t: 'err', m: 'El nombre no puede estar vacío' }); return; }
    const { error } = await sb.from('proyectos').update({ nombre: n.trim(), estado: e, unidad_avance: u, cantidad_objetivo: objNuevo }).eq('id', p.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    const { data } = await sb.from('proyectos').select('nombre,estado,unidad_avance,cantidad_objetivo').eq('id', p.id).single();
    if (!data || data.nombre !== n.trim() || data.estado !== e || data.unidad_avance !== u || (data.cantidad_objetivo == null ? null : Number(data.cantidad_objetivo)) !== objNuevo) { setMsg({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return; }
    setMsg({ t: 'ok', m: 'Guardado ✔' }); onSaved();
  }
  return (<Fragment><tr>
    <td>{p.cliente}</td>
    <td><input value={n} onChange={x => setN(x.target.value)} /></td>
    <td><select value={e} onChange={x => setE(x.target.value)}><option value="activo">Activo</option><option value="completado">Completado</option><option value="cancelado">Cancelado</option></select></td>
    <td><select value={u} onChange={x => setU(x.target.value)}>{Object.entries(UN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      {u !== 'porcentaje' && <input style={{ marginTop: 4 }} type="number" min="0" step="1" value={o} onChange={x => setO(x.target.value)} placeholder="Objetivo total" />}</td>
    <td><Barra a={p.av} /></td>
    <td>{f2(p.horas)} h<div className="muted">{p.tareas} tareas</div></td>
    <td><button className="btn btn-g" disabled={!cambiado} onClick={guardar}>Guardar</button> <button className="btn" onClick={() => setAbre(!abre)}>{abre ? 'Ocultar' : 'Ver días'}</button>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 4 }}>{msg.m}</div>}</td>
  </tr>{abre && <tr><td colSpan={7} style={{ background: 'var(--bg2)' }}><Historial p={p} /><div style={{ marginTop: 8 }}><Link className="btn" href="/planificar">Planificar una jornada para este proyecto →</Link></div></td></tr>}</Fragment>);
}

function Contenido() {
  const [rows, setRows] = useState<any[] | null>(null); const [clientes, setClientes] = useState<any[]>([]); const [err, setErr] = useState(''); const [solo, setSolo] = useState(true);
  const [nc, setNc] = useState(''); const [nn, setNn] = useState(''); const [nu, setNu] = useState('cepas'); const [no, setNo] = useState(''); const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cargar = useCallback(async () => {
    try {
      const cl = await todas((a, b) => sb.from('clientes').select('id,nombre').is('borrado_en', null).order('nombre').range(a, b)); setClientes(cl);
      const nom: Record<string, string> = {}; cl.forEach((c: any) => nom[c.id] = c.nombre);
      const pr = await todas((a, b) => sb.from('proyectos').select('id,cliente_id,nombre,estado,unidad_avance,cantidad_objetivo').is('borrado_en', null).order('nombre').range(a, b));
      const ta = await todas((a, b) => sb.from('tareas').select('id,proyecto_id').is('borrado_en', null).not('proyecto_id', 'is', null).range(a, b));
      const ho = await todas((a, b) => sb.from('jornada_trabajador').select('horas_normal,horas_extra,jornadas!inner(tareas(proyecto_id))').is('borrado_en', null).eq('ausente', false).range(a, b));
      const nt: Record<string, number> = {}; ta.forEach((t: any) => nt[t.proyecto_id] = (nt[t.proyecto_id] || 0) + 1);
      const h: Record<string, number> = {}; ho.forEach((r: any) => { const k = r.jornadas?.tareas?.proyecto_id; if (k) h[k] = (h[k] || 0) + Number(r.horas_normal) + Number(r.horas_extra); });
      const av: Record<string, any> = {};
      await Promise.all(pr.filter((p: any) => p.estado === 'activo' || nt[p.id]).map(async (p: any) => { const { data } = await sb.rpc('proyecto_avance', { p_proyecto: p.id }); av[p.id] = data?.[0] || null; }));
      setRows(pr.map((p: any) => ({ ...p, cliente: nom[p.cliente_id] || '—', tareas: nt[p.id] || 0, horas: h[p.id] || 0, av: av[p.id] || null })));
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  async function crear() {
    setMsg(null); if (!nc || !nn.trim()) { setMsg({ t: 'err', m: 'Elige cliente y pon un nombre' }); return; }
    if (nu !== 'porcentaje' && no === '') { setMsg({ t: 'err', m: 'Pon el objetivo total (cuántas cepas o kg) o elige medir por porcentaje' }); return; }
    const { data, error } = await sb.from('proyectos').insert({ cliente_id: nc, nombre: nn.trim(), unidad_avance: nu, cantidad_objetivo: nu === 'porcentaje' || no === '' ? null : Number(no) }).select('id,nombre').single();
    if (error || !data) { setMsg({ t: 'err', m: error?.message || 'No se creó' }); return; }
    setMsg({ t: 'ok', m: `Proyecto «${data.nombre}» creado ✔ Ya puedes elegirlo al planificar una jornada.` }); setNn(''); setNo(''); cargar();
  }
  const vis = (rows || []).filter(p => !solo || p.estado === 'activo');
  return (<>
    <h2 style={{ marginBottom: 4 }}>Proyectos</h2>
    <div className="muted" style={{ marginBottom: 10 }}>Un proyecto es un trabajo concreto de un cliente (por ejemplo, podar una propiedad de 12.000 cepas). Se asocia al planificar cada jornada, y el avance se calcula solo con lo que apunta el jefe.</div>
    <div className="card"><h3>Nuevo proyecto</h3><div className="row">
      <div className="field"><label>Cliente</label><select value={nc} onChange={e => setNc(e.target.value)}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
      <div className="field"><label>Nombre (propiedad, parcela…)</label><input value={nn} onChange={e => setNn(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 200 }}><label>El avance se mide en</label><select value={nu} onChange={e => setNu(e.target.value)}>{Object.entries(UN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      {nu !== 'porcentaje' && <div className="field" style={{ maxWidth: 160 }}><label>Objetivo total ({nu})</label><input type="number" min="1" value={no} onChange={e => setNo(e.target.value)} placeholder="Ej. 12000" /></div>}
      <button className="btn btn-g" onClick={crear}>Crear</button></div>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}</div>
    <div className="card"><label style={{ marginBottom: 8 }}><input type="checkbox" checked={solo} onChange={e => setSolo(e.target.checked)} /> Solo activos</label>
      {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
      {rows && <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Cliente</th><th>Proyecto</th><th>Estado</th><th>Cómo se mide</th><th>Avance</th><th>Horas</th><th></th></tr></thead><tbody>{vis.map(p => <Fila key={p.id} p={p} onSaved={cargar} />)}</tbody></table></div>}
      {rows && <div className="muted" style={{ marginTop: 6 }}>{vis.length} proyectos · el avance cuenta jornadas fichadas o validadas</div>}</div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
