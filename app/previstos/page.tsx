'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, hoy, todas } from '@/lib/supabase';

type Msg = { t: 'ok' | 'err'; m: string } | null;
const ESTADOS: Record<string, string> = { por_confirmar: 'Por confirmar', confirmado: 'Confirmado', planificado: 'Planificado', hecho: 'Hecho', cancelado: 'Cancelado' };
const fl = (f: string) => new Date(f + 'T00:00').toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const diasHasta = (f: string) => Math.round((new Date(f + 'T00:00').getTime() - new Date(hoy() + 'T00:00').getTime()) / 864e5);

function Contenido() {
  const router = useRouter();
  const [rows, setRows] = useState<any[] | null>(null); const [clientes, setClientes] = useState<any[]>([]); const [servicios, setServicios] = useState<any[]>([]); const [jefes, setJefes] = useState<any[]>([]);
  const [err, setErr] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [ver, setVer] = useState(false);
  const [f, setF] = useState({ cliente_id: '', servicio_id: '', fecha_inicio: hoy(), fecha_fin: '', personas: '', jefe_id: '', nota: '', aviso_dias: '2' });
  const cargar = useCallback(async () => {
    try {
      const [cl, sv, jf, tp] = await Promise.all([
        todas((a, b) => sb.from('clientes').select('id,nombre').is('borrado_en', null).order('nombre').range(a, b)),
        sb.from('servicios').select('id,nombre,activo').is('borrado_en', null).eq('activo', true).order('nombre'),
        sb.from('perfiles').select('user_id,nombre').eq('rol', 'jefe').eq('activo', true).order('nombre'),
        todas((a, b) => sb.from('trabajos_previstos').select('*').is('borrado_en', null).order('fecha_inicio').range(a, b)),
      ]);
      setClientes(cl); setServicios(sv.data || []); setJefes(jf.data || []); setRows(tp);
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const nc = (id: string) => clientes.find(c => c.id === id)?.nombre || '—';
  const ns = (id: string) => servicios.find(s => s.id === id)?.nombre || '';
  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!f.cliente_id || !f.fecha_inicio) { setMsg({ t: 'err', m: 'Elige cliente y fecha de inicio' }); return; }
    const { data, error } = await sb.from('trabajos_previstos').insert({ cliente_id: f.cliente_id, servicio_id: f.servicio_id || null, fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin || null, personas: f.personas ? Number(f.personas) : null, jefe_id: f.jefe_id || null, nota: f.nota.trim() || null, aviso_dias: Number(f.aviso_dias) || 0 }).select('id,fecha_inicio,cliente_id,nota').single();
    if (error || !data) { setMsg({ t: 'err', m: error?.message || 'No se creó' }); return; }
    setMsg({ t: 'ok', m: `Trabajo previsto guardado ✔ Te avisaré ${f.aviso_dias} día(s) antes.` });
    setF({ ...f, servicio_id: '', fecha_fin: '', personas: '', jefe_id: '', nota: '' }); cargar();
  }
  async function estado(r: any, e: string) {
    const { error } = await sb.from('trabajos_previstos').update({ estado: e }).eq('id', r.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; } cargar();
  }
  async function quitar(r: any) {
    if (!confirm(`¿Quitar el trabajo previsto de ${nc(r.cliente_id)} (${r.fecha_inicio})?`)) return;
    const { error } = await sb.from('trabajos_previstos').update({ borrado_en: new Date().toISOString() }).eq('id', r.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; } cargar();
  }
  function planificar(r: any) {
    try { sessionStorage.setItem('prefill', JSON.stringify({ id: r.id, cliente_id: r.cliente_id, servicio_id: r.servicio_id, fecha: r.fecha_inicio < hoy() ? hoy() : r.fecha_inicio, jefe_id: r.jefe_id, proyecto_id: r.proyecto_id, nota: r.nota })); } catch {}
    router.push('/planificar');
  }
  const abiertos = (rows || []).filter(r => r.estado === 'por_confirmar' || r.estado === 'confirmado');
  const cerrados = (rows || []).filter(r => !(r.estado === 'por_confirmar' || r.estado === 'confirmado'));
  const lista = ver ? [...abiertos, ...cerrados] : abiertos;
  return (<>
    <h2 style={{ marginBottom: 4 }}>Trabajos previstos</h2>
    <div className="muted" style={{ marginBottom: 10 }}>Apunta aquí los trabajos que te llaman aunque aún no estén definidos. Un banner te avisará unos días antes de la fecha de inicio hasta que los planifiques.</div>
    <form className="card" onSubmit={crear}><h3>Nuevo trabajo previsto</h3><div className="row">
      <div className="field"><label>Cliente</label><select required value={f.cliente_id} onChange={e => setF({ ...f, cliente_id: e.target.value })}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
      <div className="field"><label>Servicio (opcional)</label><select value={f.servicio_id} onChange={e => setF({ ...f, servicio_id: e.target.value })}><option value="">— sin definir —</option>{servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 160 }}><label>Fecha de inicio</label><input type="date" required value={f.fecha_inicio} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} /></div>
      <div className="field" style={{ maxWidth: 160 }}><label>Fecha de fin (opcional)</label><input type="date" value={f.fecha_fin} onChange={e => setF({ ...f, fecha_fin: e.target.value })} /></div></div>
      <div className="row">
      <div className="field" style={{ maxWidth: 120 }}><label>Personas</label><input type="number" min="1" value={f.personas} onChange={e => setF({ ...f, personas: e.target.value })} /></div>
      <div className="field" style={{ maxWidth: 200 }}><label>Jefe (opcional)</label><select value={f.jefe_id} onChange={e => setF({ ...f, jefe_id: e.target.value })}><option value="">— sin definir —</option>{jefes.map(j => <option key={j.user_id} value={j.user_id}>{j.nombre}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 150 }}><label>Avisar (días antes)</label><input type="number" min="0" max="60" value={f.aviso_dias} onChange={e => setF({ ...f, aviso_dias: e.target.value })} /></div>
      <div className="field"><label>Nota</label><input placeholder="Ej. llamó el propietario, 3 ha, ir a ver la parcela" value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} /></div>
      <button className="btn btn-g">Guardar</button></div>
      {msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}</form>
    <div className="card"><label style={{ marginBottom: 8 }}><input type="checkbox" checked={ver} onChange={e => setVer(e.target.checked)} /> Ver también planificados, hechos y cancelados</label>
      {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
      {rows && lista.length === 0 && <div className="muted">No hay trabajos previstos pendientes.</div>}
      {rows && lista.length > 0 && <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Inicio</th><th>Cliente · servicio</th><th>Detalle</th><th>Estado</th><th></th></tr></thead><tbody>{lista.map(r => {
        const d = diasHasta(r.fecha_inicio); const abierto = r.estado === 'por_confirmar' || r.estado === 'confirmado';
        return (<tr key={r.id} className={abierto && d <= r.aviso_dias ? 'pend' : ''}>
          <td style={{ whiteSpace: 'nowrap' }}>{fl(r.fecha_inicio)}{abierto && <div className="muted" style={{ color: d < 0 ? 'var(--r)' : undefined }}>{d < 0 ? `hace ${-d} día(s)` : d === 0 ? 'HOY' : d === 1 ? 'mañana' : `en ${d} días`}</div>}</td>
          <td><b>{nc(r.cliente_id)}</b>{r.servicio_id && <div className="muted">{ns(r.servicio_id)}</div>}</td>
          <td>{r.fecha_fin ? <div className="muted">hasta {fl(r.fecha_fin)}</div> : null}{r.personas ? <div className="muted">{r.personas} personas</div> : null}{r.nota && <div>{r.nota}</div>}</td>
          <td><select value={r.estado} onChange={e => estado(r, e.target.value)}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
          <td style={{ whiteSpace: 'nowrap' }}>{abierto && <button className="btn btn-g" onClick={() => planificar(r)}>Planificar</button>} <button className="btn" onClick={() => quitar(r)}>Quitar</button></td></tr>);
      })}</tbody></table></div>}</div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
