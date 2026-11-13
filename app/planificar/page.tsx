'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Shell from '@/lib/Shell';
import { sb, hoy, todas, Perfil } from '@/lib/supabase';

type Msg = { t: 'ok' | 'err'; m: string } | null;
const MOD: Record<string, string> = { hora: 'por hora', cepa: 'por cepa', kg: 'por kg' };
const fechaLarga = (f: string) => new Date(f + 'T00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

function Selector({ trabajadores, sel, setSel, ocupados }: any) {
  const [q, setQ] = useState('');
  const vis = trabajadores.filter((t: any) => t.nombre.toLowerCase().includes(q.toLowerCase()));
  return (<div>
    <div className="row" style={{ marginBottom: 6 }}>
      <div className="field" style={{ maxWidth: 240 }}><input placeholder="Buscar trabajador…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <span className="muted"><b>{sel.size}</b> seleccionados</span>
      {sel.size > 0 && <button type="button" className="btn" onClick={() => setSel(new Set())}>Quitar todos</button>}
    </div>
    <div className="chips">{vis.map((t: any) => {
      const on = sel.has(t.id); const oc = ocupados?.[t.id];
      return <label key={t.id} className={'chip' + (on ? ' on' : '') + (oc ? ' oc' : '')} title={oc ? 'Ya asignado ese día: ' + oc : ''}>
        <input type="checkbox" checked={on} onChange={() => { const n = new Set(sel); on ? n.delete(t.id) : n.add(t.id); setSel(n); }} />
        {t.nombre}{oc && <i> · ya asignado</i>}</label>;
    })}</div>
  </div>);
}

function Equipo({ j, trabajadores, onDone }: any) {
  const actuales = (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en);
  const [sel, setSel] = useState<Set<string>>(new Set(actuales.map((l: any) => l.trabajador_id)));
  const [msg, setMsg] = useState<Msg>(null);
  async function guardar() {
    setMsg(null);
    const quitar = actuales.filter((l: any) => !sel.has(l.trabajador_id));
    const poner = [...sel].filter(id => !actuales.some((l: any) => l.trabajador_id === id));
    if (quitar.some((l: any) => l.confirmado)) { setMsg({ t: 'err', m: 'No se puede quitar a alguien que el jefe ya confirmó.' }); return; }
    if (quitar.length) {
      const { error } = await sb.from('jornada_trabajador').update({ borrado_en: new Date().toISOString() }).eq('jornada_id', j.id).in('trabajador_id', quitar.map((l: any) => l.trabajador_id));
      if (error) { setMsg({ t: 'err', m: error.message }); return; }
    }
    if (poner.length) {
      const { error } = await sb.from('jornada_trabajador').upsert(poner.map(id => ({ jornada_id: j.id, trabajador_id: id, asignado: true, confirmado: false, horas_normal: 0, horas_extra: 0, ausente: false, funcion: null, borrado_en: null })), { onConflict: 'jornada_id,trabajador_id' });
      if (error) { setMsg({ t: 'err', m: error.message }); return; }
    }
    const { data } = await sb.from('jornada_trabajador').select('trabajador_id').eq('jornada_id', j.id).is('borrado_en', null);
    const ids = new Set((data || []).map((x: any) => x.trabajador_id));
    if (ids.size !== sel.size || [...sel].some(id => !ids.has(id))) { setMsg({ t: 'err', m: 'El servidor no devolvió el mismo equipo. NO está guardado.' }); return; }
    setMsg({ t: 'ok', m: 'Equipo guardado ✔' }); onDone();
  }
  return (<div style={{ marginTop: 8 }}>
    <Selector trabajadores={trabajadores} sel={sel} setSel={setSel} />
    {msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}
    <button className="btn btn-g" style={{ marginTop: 8 }} onClick={guardar}>Guardar equipo</button>
  </div>);
}

function Servicios({ servicios, onDone }: any) {
  const [n, setN] = useState(''); const [m, setM] = useState('hora'); const [t, setT] = useState(''); const [msg, setMsg] = useState<Msg>(null);
  async function crear() {
    setMsg(null); if (!n.trim()) { setMsg({ t: 'err', m: 'Pon un nombre' }); return; }
    const { error } = await sb.from('servicios').insert({ nombre: n.trim(), modalidad: m, temporada: t || null });
    if (error) { setMsg({ t: 'err', m: error.message.includes('servicios_nombre_uq') ? 'Ese servicio ya existe' : error.message }); return; }
    setN(''); setMsg({ t: 'ok', m: 'Servicio creado ✔' }); onDone();
  }
  async function cambiar(s: any, patch: any) {
    const { error } = await sb.from('servicios').update(patch).eq('id', s.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; } onDone();
  }
  return (<div className="card"><h3>Servicios que realizamos</h3>
    <div className="muted" style={{ marginBottom: 8 }}>Esta lista es la que aparece al planificar. Desactiva los que no uses.</div>
    {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
    <table><thead><tr><th>Servicio</th><th>Modalidad habitual</th><th>Temporada</th><th>Activo</th></tr></thead><tbody>
      {servicios.map((s: any) => <tr key={s.id}><td>{s.nombre}</td>
        <td><select value={s.modalidad} onChange={e => cambiar(s, { modalidad: e.target.value })}>{Object.entries(MOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
        <td><select value={s.temporada || ''} onChange={e => cambiar(s, { temporada: e.target.value || null })}><option value="">—</option><option value="invierno">invierno</option><option value="primavera">primavera</option><option value="vendimia">vendimia</option></select></td>
        <td><input type="checkbox" checked={s.activo} onChange={e => cambiar(s, { activo: e.target.checked })} /></td></tr>)}
    </tbody></table>
    <div className="row" style={{ marginTop: 10 }}>
      <div className="field"><label>Nuevo servicio</label><input value={n} onChange={e => setN(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 140 }}><label>Modalidad</label><select value={m} onChange={e => setM(e.target.value)}>{Object.entries(MOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 140 }}><label>Temporada</label><select value={t} onChange={e => setT(e.target.value)}><option value="">—</option><option value="invierno">invierno</option><option value="primavera">primavera</option><option value="vendimia">vendimia</option></select></div>
      <button className="btn btn-g" onClick={crear}>Añadir</button></div></div>);
}

function Contenido({ perfil }: { perfil: Perfil }) {
  const admin = perfil.rol === 'admin';
  const [servicios, setServicios] = useState<any[]>([]); const [clientes, setClientes] = useState<any[]>([]); const [jefes, setJefes] = useState<any[]>([]);
  const [trabajadores, setTrabajadores] = useState<any[]>([]); const [js, setJs] = useState<any[]>([]); const [dia, setDia] = useState<any[]>([]);
  const [f, setF] = useState({ servicio_id: '', modalidad: 'hora', cliente_id: '', fecha: hoy(), jefe_id: '', proyecto_id: '' });
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null); const [verServ, setVerServ] = useState(false);

  const cargar = useCallback(async () => {
    const [a, b, c, d, e, pq] = await Promise.all([
      sb.from('servicios').select('*').is('borrado_en', null).order('nombre'),
      todas((x, z) => sb.from('clientes').select('id,nombre').is('borrado_en', null).order('nombre').range(x, z)),
      sb.from('perfiles').select('user_id,nombre').eq('rol', 'jefe').eq('activo', true).order('nombre'),
      todas((x, z) => sb.from('trabajadores').select('id,nombre').eq('estado', 'activo').is('borrado_en', null).order('nombre').range(x, z)),
      sb.from('jornadas').select('id,fecha,estado,perfiles:jefe_id(nombre),tareas(nombre,modalidad,clientes(nombre)),jornada_trabajador(trabajador_id,confirmado,borrado_en,trabajadores(nombre))').is('borrado_en', null).gte('fecha', hoy()).order('fecha').limit(60),
      sb.from('proyectos').select('id,cliente_id,nombre,unidad_avance,cantidad_objetivo').eq('estado', 'activo').is('borrado_en', null).order('nombre'),
    ]);
    setProyectos(pq.data || []);
    setServicios(a.data || []); setClientes(b); setJefes(c.data || []); setTrabajadores(d); setJs(e.data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { (async () => {
    const { data } = await sb.from('jornada_trabajador').select('trabajador_id,jornadas!inner(fecha,tareas(nombre,clientes(nombre)))').is('borrado_en', null).eq('jornadas.fecha', f.fecha);
    setDia(data || []);
  })(); }, [f.fecha, js]);
  const ocupados = useMemo(() => { const o: Record<string, string> = {}; dia.forEach((r: any) => { o[r.trabajador_id] = r.jornadas?.tareas?.clientes?.nombre || ''; }); return o; }, [dia]);
  const serviciosActivos = servicios.filter(s => s.activo);
  const [ult, setUlt] = useState<any>(null);
  useEffect(() => { (async () => {
    setUlt(null); if (!f.cliente_id || !f.servicio_id) return;
    const { data } = await sb.from('jornadas').select('fecha,jefe_id,perfiles:jefe_id(nombre),tareas!inner(cliente_id,servicio_id),jornada_trabajador(trabajador_id,borrado_en)').eq('tareas.cliente_id', f.cliente_id).eq('tareas.servicio_id', f.servicio_id).is('borrado_en', null).lt('fecha', f.fecha).order('fecha', { ascending: false }).limit(1);
    const u = data?.[0]; if (u) setUlt({ fecha: u.fecha, jefe_id: u.jefe_id, jefe: (u as any).perfiles?.nombre, ids: (u.jornada_trabajador || []).filter((l: any) => !l.borrado_en).map((l: any) => l.trabajador_id) });
  })(); }, [f.cliente_id, f.servicio_id, f.fecha]);
  const repetir = () => { if (!ult) return; setF(x => ({ ...x, jefe_id: ult.jefe_id || x.jefe_id })); setSel(new Set(ult.ids.filter((id: string) => trabajadores.some((t: any) => t.id === id)))); };

  async function crear(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!f.servicio_id || !f.cliente_id || !f.jefe_id) { setMsg({ t: 'err', m: 'Elige servicio, cliente y jefe de equipo' }); return; }
    if (sel.size === 0) { setMsg({ t: 'err', m: 'Asigna al menos un trabajador' }); return; }
    setBusy(true);
    try {
      const srv = servicios.find(s => s.id === f.servicio_id);
      let tq = sb.from('tareas').select('id').eq('cliente_id', f.cliente_id).eq('servicio_id', f.servicio_id).eq('modalidad', f.modalidad).eq('estado', 'activa').is('borrado_en', null);
      tq = f.proyecto_id ? tq.eq('proyecto_id', f.proyecto_id) : tq.is('proyecto_id', null);
      const { data: t } = await tq.limit(1);
      let tarea_id = t?.[0]?.id;
      if (!tarea_id) {
        const r = await sb.from('tareas').insert({ cliente_id: f.cliente_id, servicio_id: f.servicio_id, nombre: srv.nombre, temporada: srv.temporada, modalidad: f.modalidad, proyecto_id: f.proyecto_id || null }).select('id').single();
        if (r.error || !r.data) throw new Error(r.error?.message || 'No se pudo crear la tarea'); tarea_id = r.data.id;
      }
      const j = await sb.from('jornadas').insert({ tarea_id, fecha: f.fecha, jefe_id: f.jefe_id }).select('id').single();
      if (j.error || !j.data) throw new Error(j.error?.message || 'No se pudo crear la jornada');
      const l = await sb.from('jornada_trabajador').insert([...sel].map(id => ({ jornada_id: j.data.id, trabajador_id: id, asignado: true, confirmado: false, horas_normal: 0, horas_extra: 0, ausente: false })));
      if (l.error) throw new Error('La jornada se creó pero falló la asignación del equipo (' + l.error.message + '). Ábrela en la lista de abajo y asigna el equipo.');
      const { count } = await sb.from('jornada_trabajador').select('id', { count: 'exact', head: true }).eq('jornada_id', j.data.id).is('borrado_en', null);
      if (count !== sel.size) throw new Error('El servidor guardó ' + count + ' de ' + sel.size + ' trabajadores. Revisa la lista de abajo.');
      setMsg({ t: 'ok', m: `Jornada creada ✔ ${srv.nombre}${f.proyecto_id ? ' (' + (proyectos.find(x => x.id === f.proyecto_id)?.nombre || '') + ')' : ''} · ${fechaLarga(f.fecha)} · ${sel.size} trabajadores. El jefe ya la ve.` });
      setSel(new Set());
    } catch (er: any) { setMsg({ t: 'err', m: er.message }); }
    setBusy(false); cargar();
  }
  async function anular(j: any) {
    if (!confirm(`¿Anular la jornada de ${j.tareas?.clientes?.nombre} (${j.fecha})?`)) return;
    const { error } = await sb.from('jornadas').update({ borrado_en: new Date().toISOString() }).eq('id', j.id);
    if (error) alert(error.message); cargar();
  }

  return (<>
    <h2 style={{ marginBottom: 10 }}>Planificar</h2>
    <form className="card" onSubmit={crear}>
      <h3>Nueva jornada</h3>
      {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
      <div className="row">
        <div className="field"><label>Servicio</label><select required value={f.servicio_id} onChange={e => { const s = servicios.find(x => x.id === e.target.value); setF({ ...f, servicio_id: e.target.value, modalidad: s?.modalidad || 'hora' }); }}><option value="">— elegir —</option>{serviciosActivos.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 140 }}><label>Se trabaja</label><select value={f.modalidad} onChange={e => setF({ ...f, modalidad: e.target.value })}>{Object.entries(MOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label>Cliente</label><select required value={f.cliente_id} onChange={e => setF({ ...f, cliente_id: e.target.value, proyecto_id: '' })}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
        {proyectos.some(x => x.cliente_id === f.cliente_id) && <div className="field"><label>Proyecto (opcional)</label><select value={f.proyecto_id} onChange={e => { const pr = proyectos.find(x => x.id === e.target.value); setF({ ...f, proyecto_id: e.target.value, modalidad: pr ? (pr.unidad_avance === 'cepas' ? 'cepa' : pr.unidad_avance === 'kg' ? 'kg' : f.modalidad) : f.modalidad }); }}><option value="">— trabajo suelto, sin proyecto —</option>{proyectos.filter(x => x.cliente_id === f.cliente_id).map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>}
        <div className="field" style={{ maxWidth: 170 }}><label>Fecha</label><input type="date" required value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></div>
        <div className="field"><label>Jefe de equipo</label><select required value={f.jefe_id} onChange={e => setF({ ...f, jefe_id: e.target.value })}><option value="">— elegir —</option>{jefes.map(x => <option key={x.user_id} value={x.user_id}>{x.nombre}</option>)}</select></div>
      </div>
      {f.modalidad !== 'hora' && <div className="muted" style={{ marginTop: 6 }}>Trabajo {MOD[f.modalidad]}: el jefe tendrá que indicar el total de {f.modalidad === 'cepa' ? 'cepas' : 'kg'} realizado para poder fichar.</div>}
      {ult && <div className="msg ok" style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span>La última vez ({fechaLarga(ult.fecha)}): jefe {ult.jefe || '—'} y {ult.ids.length} trabajadores.</span><button type="button" className="btn btn-g" onClick={repetir}>↻ Repetir ese equipo</button></div>}
      <div style={{ marginTop: 12 }}><label>Trabajadores asignados</label>
        <Selector trabajadores={trabajadores} sel={sel} setSel={setSel} ocupados={ocupados} /></div>
      <div style={{ marginTop: 12 }}><button className="btn btn-g" disabled={busy}>{busy ? 'Creando…' : 'Crear jornada'}</button></div>
    </form>

    <div className="card"><h3>Próximas jornadas</h3>
      {js.length === 0 && <div className="muted">Ninguna.</div>}
      {js.map(x => { const ls = (x.jornada_trabajador || []).filter((l: any) => !l.borrado_en); const sinConf = ls.filter((l: any) => !l.confirmado).length;
        return (<div key={x.id} className="jrow">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div><b>{fechaLarga(x.fecha)}</b> · {x.tareas?.clientes?.nombre} — {x.tareas?.nombre} <span className="muted">({MOD[x.tareas?.modalidad]})</span>
              <div className="muted">Jefe: {x.perfiles?.nombre || '—'} · {ls.length} trabajadores{x.estado === 'planificada' && sinConf > 0 ? ` · ${sinConf} sin confirmar` : ''}</div></div>
            <div className="row"><span className={'badge ' + (x.estado === 'validada' ? 'b-va' : x.estado === 'fichada' ? 'b-fi' : 'b-pl')}>{x.estado}</span>
              {x.estado === 'planificada' && <><button className="btn" onClick={() => setAbierto(abierto === x.id ? null : x.id)}>Equipo</button><button className="btn" onClick={() => anular(x)}>Anular</button></>}</div></div>
          <div className="muted" style={{ marginTop: 4 }}>{ls.map((l: any) => l.trabajadores?.nombre).join(', ')}</div>
          {abierto === x.id && <Equipo j={x} trabajadores={trabajadores} onDone={() => { cargar(); }} />}
        </div>); })}
    </div>

    {admin && <><button className="btn" style={{ marginBottom: 12 }} onClick={() => setVerServ(!verServ)}>{verServ ? 'Ocultar' : 'Gestionar'} lista de servicios</button>
      {verServ && <Servicios servicios={servicios} onDone={cargar} />}</>}
  </>);
}
export default function Planificar() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido perfil={p} />}</Shell>; }
