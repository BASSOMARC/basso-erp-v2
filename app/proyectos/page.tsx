'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas } from '@/lib/supabase';
const f2 = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 2 });

function Fila({ p, onSaved }: any) {
  const [n, setN] = useState(p.nombre); const [e, setE] = useState(p.estado); const [u, setU] = useState(p.unidad_avance); const [o, setO] = useState(p.cantidad_objetivo == null ? '' : String(p.cantidad_objetivo));
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cambiado = n !== p.nombre || e !== p.estado || u !== p.unidad_avance || o !== (p.cantidad_objetivo == null ? '' : String(p.cantidad_objetivo));
  async function guardar() {
    if (!n.trim()) { setMsg({ t: 'err', m: 'El nombre no puede estar vacío' }); return; }
    const obj = o === '' ? null : Number(o);
    const { error } = await sb.from('proyectos').update({ nombre: n.trim(), estado: e, unidad_avance: u, cantidad_objetivo: obj }).eq('id', p.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    const { data } = await sb.from('proyectos').select('nombre,estado,unidad_avance,cantidad_objetivo').eq('id', p.id).single();
    if (!data || data.nombre !== n.trim() || data.estado !== e || data.unidad_avance !== u || (data.cantidad_objetivo == null ? null : Number(data.cantidad_objetivo)) !== obj) { setMsg({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return; }
    setMsg({ t: 'ok', m: 'Guardado ✔' }); onSaved();
  }
  return (<tr>
    <td>{p.cliente}</td>
    <td><input value={n} onChange={x => setN(x.target.value)} /></td>
    <td><select value={e} onChange={x => setE(x.target.value)}><option value="activo">Activo</option><option value="completado">Completado</option><option value="cancelado">Cancelado</option></select></td>
    <td><select value={u} onChange={x => setU(x.target.value)}><option value="cepas">cepas</option><option value="kg">kg</option></select></td>
    <td><input type="number" min="0" step="1" value={o} onChange={x => setO(x.target.value)} placeholder="—" /></td>
    <td>{p.tareas}</td><td>{f2(p.horas)} h</td>
    <td><button className="btn btn-g" disabled={!cambiado} onClick={guardar}>Guardar</button>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 4 }}>{msg.m}</div>}</td>
  </tr>);
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
      setRows(pr.map((p: any) => ({ ...p, cliente: nom[p.cliente_id] || '—', tareas: nt[p.id] || 0, horas: h[p.id] || 0 })));
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  async function crear() {
    setMsg(null); if (!nc || !nn.trim()) { setMsg({ t: 'err', m: 'Elige cliente y pon un nombre' }); return; }
    const { data, error } = await sb.from('proyectos').insert({ cliente_id: nc, nombre: nn.trim(), unidad_avance: nu, cantidad_objetivo: no === '' ? null : Number(no) }).select('id,nombre').single();
    if (error || !data) { setMsg({ t: 'err', m: error?.message || 'No se creó' }); return; }
    setMsg({ t: 'ok', m: `Proyecto «${data.nombre}» creado ✔` }); setNn(''); setNo(''); cargar();
  }
  const vis = (rows || []).filter(p => !solo || p.estado === 'activo');
  return (<>
    <h2 style={{ marginBottom: 10 }}>Proyectos</h2>
    <div className="card"><h3>Nuevo proyecto</h3><div className="row">
      <div className="field"><label>Cliente</label><select value={nc} onChange={e => setNc(e.target.value)}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
      <div className="field"><label>Nombre</label><input value={nn} onChange={e => setNn(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 110 }}><label>Unidad</label><select value={nu} onChange={e => setNu(e.target.value)}><option value="cepas">cepas</option><option value="kg">kg</option></select></div>
      <div className="field" style={{ maxWidth: 130 }}><label>Objetivo</label><input type="number" min="0" value={no} onChange={e => setNo(e.target.value)} placeholder="opcional" /></div>
      <button className="btn btn-g" onClick={crear}>Crear</button></div>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}</div>
    <div className="card"><label style={{ marginBottom: 8 }}><input type="checkbox" checked={solo} onChange={e => setSolo(e.target.checked)} /> Solo activos</label>
      {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
      {rows && <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Cliente</th><th>Proyecto</th><th>Estado</th><th>Unidad</th><th>Objetivo</th><th>Tareas</th><th>Horas</th><th></th></tr></thead><tbody>{vis.map(p => <Fila key={p.id} p={p} onSaved={cargar} />)}</tbody></table></div>}
      {rows && <div className="muted" style={{ marginTop: 6 }}>{vis.length} proyectos</div>}</div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
