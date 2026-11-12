'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, hoy, Perfil } from '@/lib/supabase';

type Est = 'pend' | 'pres' | 'aus';
type Linea = { trabajador_id: string; nombre: string; h: string; he: string; est: Est; funcion: string | null; asignado: boolean };
type Msg = { t: 'ok' | 'err'; m: string } | null;
const num = (v: string) => (v === '' ? 0 : Number(String(v).replace(',', '.')));
const TIPOS: Record<string, string> = { accidente: 'Accidente', retraso: 'Retraso', material: 'Falta de material', clima: 'Clima', cliente: 'Cliente', otra: 'Otra' };

function Incidencias({ j, lineas, editable }: any) {
  const [lista, setLista] = useState<any[]>((j.incidencias || []).filter((i: any) => !i.borrado_en));
  const [tipo, setTipo] = useState('otra'); const [tr, setTr] = useState(''); const [d, setD] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [abierto, setAbierto] = useState(false);
  async function crear() {
    setMsg(null); if (d.trim().length < 3) { setMsg({ t: 'err', m: 'Describe la incidencia' }); return; }
    const { data, error } = await sb.from('incidencias').insert({ jornada_id: j.id, tipo, descripcion: d.trim(), trabajador_id: tr || null }).select('id,tipo,descripcion,estado,trabajador_id').single();
    if (error || !data) { setMsg({ t: 'err', m: 'No se guardó: ' + (error?.message || 'sin respuesta') }); return; }
    setLista(l => [...l, data]); setD(''); setTr(''); setTipo('otra'); setMsg({ t: 'ok', m: 'Incidencia registrada ✔ El administrador la verá.' });
  }
  return (<div style={{ marginTop: 12 }}>
    {lista.map(i => <div key={i.id} className={'inc' + (i.estado === 'resuelta' ? ' res' : '')}><b>{TIPOS[i.tipo]}</b>{i.trabajador_id ? ' · ' + (lineas.find((l: Linea) => l.trabajador_id === i.trabajador_id)?.nombre || '') : ''}: {i.descripcion} <span className="muted">({i.estado})</span></div>)}
    {editable && !abierto && <button className="btn" onClick={() => setAbierto(true)}>⚠ Registrar incidencia</button>}
    {editable && abierto && <div className="card" style={{ background: 'var(--bg2)' }}>
      {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
      <div className="row">
        <div className="field" style={{ maxWidth: 170 }}><label>Tipo</label><select value={tipo} onChange={e => setTipo(e.target.value)}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 200 }}><label>Trabajador (opcional)</label><select value={tr} onChange={e => setTr(e.target.value)}><option value="">— nadie en concreto —</option>{lineas.map((l: Linea) => <option key={l.trabajador_id} value={l.trabajador_id}>{l.nombre}</option>)}</select></div>
        <div className="field" style={{ minWidth: 220 }}><label>Qué ha pasado</label><input value={d} onChange={e => setD(e.target.value)} /></div>
        <button className="btn btn-g" onClick={crear}>Registrar</button>
      </div></div>}
  </div>);
}

function Jornada({ j, trabajadores, onChange }: any) {
  const editable = j.estado !== 'validada';
  const [lineas, setLineas] = useState<Linea[]>(() => (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en).map((l: any) => ({
    trabajador_id: l.trabajador_id, nombre: l.trabajadores?.nombre || '?', h: l.horas_normal ? String(l.horas_normal) : '', he: l.horas_extra ? String(l.horas_extra) : '',
    est: !l.confirmado ? 'pend' : l.ausente ? 'aus' : 'pres', funcion: l.funcion, asignado: l.asignado })).sort((a: Linea, b: Linea) => a.nombre.localeCompare(b.nombre)));
  const modalidad = j.tareas?.modalidad || 'hora';
  const porUnidad = modalidad === 'cepa' || modalidad === 'kg';
  const cant0 = (j.jornada_cantidad || []).find((c: any) => !c.borrado_en);
  const [unidad, setUnidad] = useState(cant0?.unidad || (modalidad === 'kg' ? 'kg' : 'cepas'));
  const [cant, setCant] = useState(cant0 ? String(cant0.cantidad) : '');
  const [nuevo, setNuevo] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const [obs, setObs] = useState<string>(j.observaciones || '');
  const vendimia = j.tareas?.temporada === 'vendimia';
  const set = (i: number, patch: Partial<Linea>) => setLineas(ls => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const disponibles = trabajadores.filter((t: any) => !lineas.some(l => l.trabajador_id === t.id));
  const pend = lineas.filter(l => l.est === 'pend').length;

  async function guardar(): Promise<boolean> {
    setBusy(true); setMsg(null);
    try {
      const conf = lineas.filter(l => l.est !== 'pend');
      const rows = conf.map(l => ({ jornada_id: j.id, trabajador_id: l.trabajador_id, horas_normal: l.est === 'aus' ? 0 : num(l.h), horas_extra: l.est === 'aus' ? 0 : num(l.he), ausente: l.est === 'aus', funcion: l.est === 'aus' ? null : l.funcion, confirmado: true, asignado: l.asignado, borrado_en: null }));
      if (rows.length) { const { error } = await sb.from('jornada_trabajador').upsert(rows, { onConflict: 'jornada_id,trabajador_id' }); if (error) throw new Error(error.message); }
      if (cant !== '') { const { error } = await sb.from('jornada_cantidad').upsert({ jornada_id: j.id, unidad, cantidad: num(cant), borrado_en: null }, { onConflict: 'jornada_id,unidad' }); if (error) throw new Error(error.message); }
      const { data, error } = await sb.from('jornada_trabajador').select('trabajador_id,horas_normal,horas_extra,ausente,funcion,confirmado').eq('jornada_id', j.id).is('borrado_en', null);
      if (error) throw new Error(error.message);
      for (const r of rows) {
        const s = (data || []).find((x: any) => x.trabajador_id === r.trabajador_id);
        if (!s || !s.confirmado || Number(s.horas_normal) !== r.horas_normal || Number(s.horas_extra) !== r.horas_extra || s.ausente !== r.ausente || (s.funcion || null) !== (r.funcion || null))
          throw new Error('El servidor no devolvió los mismos valores que enviaste. NO se da por guardado. Avisa a un administrador.');
      }
      if (cant !== '') { const { data: c } = await sb.from('jornada_cantidad').select('cantidad').eq('jornada_id', j.id).eq('unidad', unidad).is('borrado_en', null).maybeSingle(); if (!c || Number(c.cantidad) !== num(cant)) throw new Error('La cantidad no se guardó correctamente.'); }
      if (obs !== (j.observaciones || '')) {
        const { error: eo } = await sb.from('jornadas').update({ observaciones: obs.trim() || null }).eq('id', j.id); if (eo) throw new Error(eo.message);
        const { data: o } = await sb.from('jornadas').select('observaciones').eq('id', j.id).single(); if ((o?.observaciones || '') !== obs.trim()) throw new Error('Las observaciones no se guardaron correctamente.');
        j.observaciones = obs.trim() || null; setObs(obs.trim());
      }
      setMsg({ t: 'ok', m: 'Guardado y verificado en el servidor ✔' }); return true;
    } catch (e: any) { setMsg({ t: 'err', m: 'No se guardó: ' + e.message }); return false; }
    finally { setBusy(false); }
  }
  async function fichar() {
    if (pend) { setMsg({ t: 'err', m: `Faltan ${pend} trabajador(es) por marcar como presentes o ausentes.` }); return; }
    if (!lineas.length) { setMsg({ t: 'err', m: 'Añade al menos un trabajador' }); return; }
    if (lineas.some(l => l.est === 'pres' && num(l.h) + num(l.he) <= 0)) { setMsg({ t: 'err', m: 'Hay trabajadores presentes sin horas.' }); return; }
    if (porUnidad && num(cant) <= 0) { setMsg({ t: 'err', m: `Esta jornada es ${modalidad === 'cepa' ? 'por cepa' : 'por kg'}: indica el total realizado.` }); return; }
    if (!(await guardar())) return;
    setBusy(true);
    const { data, error } = await sb.from('jornadas').update({ estado: 'fichada' }).eq('id', j.id).select('id,estado');
    setBusy(false);
    if (error || !data?.length || data[0].estado !== 'fichada') { setMsg({ t: 'err', m: 'No se pudo fichar: ' + (error?.message || 'sin cambios') }); return; }
    setMsg({ t: 'ok', m: 'Jornada fichada ✔ Pendiente de validación' }); onChange();
  }
  async function quitar(i: number) {
    const l = lineas[i];
    if (l.asignado) return;
    const { error } = await sb.from('jornada_trabajador').update({ borrado_en: new Date().toISOString() }).eq('jornada_id', j.id).eq('trabajador_id', l.trabajador_id);
    if (error && !/0 rows/.test(error.message)) { setMsg({ t: 'err', m: error.message }); return; }
    setLineas(ls => ls.filter((_, k) => k !== i));
  }
  const total = lineas.reduce((s, l) => s + (l.est === 'pres' ? num(l.h) + num(l.he) : 0), 0);

  return (<div className="card">
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div><h3 style={{ marginBottom: 2 }}>{j.tareas?.nombre} — {j.tareas?.clientes?.nombre}</h3>
        <div className="muted">{j.perfiles?.nombre ? 'Jefe: ' + j.perfiles.nombre + ' · ' : ''}{modalidad === 'hora' ? 'Por horas' : modalidad === 'cepa' ? 'Por cepa' : 'Por kg'}</div></div>
      <span className={'badge ' + (j.estado === 'validada' ? 'b-va' : j.estado === 'fichada' ? 'b-fi' : 'b-pl')}>{j.estado}</span>
    </div>
    {msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}
    {!editable && <div className="muted" style={{ margin: '8px 0' }}>Jornada validada: para corregirla, un administrador usa «Control de horas».</div>}
    {editable && pend > 0 && <div className="muted" style={{ margin: '8px 0' }}>Confirma uno por uno si cada trabajador asignado ha venido.</div>}
    <div style={{ overflowX: 'auto' }}><table>
      <thead><tr><th>Trabajador</th><th>Asistencia</th><th>Horas</th><th>Extra</th>{vendimia && <th>P/C</th>}<th></th></tr></thead>
      <tbody>{lineas.map((l, i) => (<tr key={l.trabajador_id} className={l.est === 'pend' ? 'pend' : ''}>
        <td>{l.nombre}{!l.asignado && <div className="muted">añadido por el jefe</div>}</td>
        <td><div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
          <button type="button" disabled={!editable} className={'btn btn-ok' + (l.est === 'pres' ? ' on' : '')} onClick={() => set(i, { est: 'pres', h: l.h || '8', funcion: vendimia ? (l.funcion || 'coupeur') : l.funcion })}>Presente</button>
          <button type="button" disabled={!editable} className={'btn btn-no' + (l.est === 'aus' ? ' on' : '')} onClick={() => set(i, { est: 'aus' })}>Ausente</button></div></td>
        <td><input type="number" step="0.25" min="0" max="24" inputMode="decimal" disabled={!editable || l.est !== 'pres'} value={l.h} onChange={e => set(i, { h: e.target.value })} /></td>
        <td><input type="number" step="0.25" min="0" max="24" inputMode="decimal" disabled={!editable || l.est !== 'pres'} value={l.he} onChange={e => set(i, { he: e.target.value })} /></td>
        {vendimia && <td><button type="button" disabled={!editable || l.est !== 'pres'} className={'btn btn-p' + (l.funcion === 'porteur' ? ' on' : '')} title="Porteur" onClick={() => set(i, { funcion: l.funcion === 'porteur' ? 'coupeur' : 'porteur' })}>{l.funcion === 'porteur' ? 'P' : 'C'}</button></td>}
        <td>{editable && !l.asignado && <button className="btn" onClick={() => quitar(i)}>Quitar</button>}</td>
      </tr>))}</tbody>
    </table></div>
    {editable && <div className="row" style={{ marginTop: 8 }}>
      <div className="field"><select value={nuevo} onChange={e => setNuevo(e.target.value)}><option value="">+ Añadir otro trabajador (sustitución)…</option>{disponibles.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
      <button className="btn" disabled={!nuevo} onClick={() => { const t = trabajadores.find((x: any) => x.id === nuevo); setLineas(ls => [...ls, { trabajador_id: t.id, nombre: t.nombre, h: '8', he: '', est: 'pres', aus: false, funcion: vendimia ? 'coupeur' : null, asignado: false } as any]); setNuevo(''); }}>Añadir</button>
    </div>}
    <div className="row" style={{ marginTop: 10 }}>
      <div className="field" style={{ maxWidth: 200 }}><label>{porUnidad ? (modalidad === 'cepa' ? 'Total de cepas realizadas (equipo) *' : 'Total de kg realizados (equipo) *') : 'Cantidad realizada (opcional)'}</label>
        <input type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={cant} onChange={e => setCant(e.target.value)} /></div>
      {!porUnidad && <div className="field" style={{ maxWidth: 110 }}><label>Unidad</label><select disabled={!editable} value={unidad} onChange={e => setUnidad(e.target.value)}><option value="cepas">cepas</option><option value="kg">kg</option></select></div>}
      <div className="muted">Horas del día: <b>{total}</b></div>
    </div>
    <div style={{ marginTop: 12 }}><label>Observaciones de la jornada (opcional)</label>
      <textarea rows={2} maxLength={2000} disabled={!editable} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej. parcela terminada, falta la fila 12, material en mal estado…" /></div>
    <Incidencias j={j} lineas={lineas} editable={editable} />
    {editable && <div className="row" style={{ marginTop: 12 }}>
      <button className="btn" disabled={busy} onClick={guardar}>Guardar</button>
      {j.estado === 'planificada' && <button className="btn btn-g" disabled={busy} onClick={fichar}>Fichar jornada</button>}
      {j.estado === 'fichada' && <span className="muted">Fichada. Si corriges algo, pulsa Guardar.</span>}
    </div>}
  </div>);
}

function Contenido({ perfil }: { perfil: Perfil }) {
  const [fecha, setFecha] = useState(hoy());
  const [jornadas, setJornadas] = useState<any[] | null>(null); const [trabajadores, setTrabajadores] = useState<any[]>([]); const [prox, setProx] = useState<Record<string, number>>({}); const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    setJornadas(null); setErr('');
    const { data, error } = await sb.from('jornadas')
      .select('id,fecha,estado,observaciones,perfiles:jefe_id(nombre),tareas(nombre,temporada,modalidad,clientes(nombre)),jornada_trabajador(trabajador_id,horas_normal,horas_extra,ausente,funcion,borrado_en,confirmado,asignado,trabajadores(nombre)),jornada_cantidad(unidad,cantidad,borrado_en),incidencias(id,tipo,descripcion,estado,trabajador_id,borrado_en)')
      .eq('fecha', fecha).is('borrado_en', null).order('creado_en');
    if (error) { setErr(error.message); return; }
    setJornadas(data || []);
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { sb.from('trabajadores').select('id,nombre').eq('estado', 'activo').is('borrado_en', null).order('nombre').then(({ data }) => setTrabajadores(data || [])); }, []);
  useEffect(() => { (async () => {
    const { data } = await sb.from('jornadas').select('fecha').is('borrado_en', null).gte('fecha', hoy()).lte('fecha', new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)).eq('estado', 'planificada');
    const o: Record<string, number> = {}; (data || []).forEach((r: any) => { o[r.fecha] = (o[r.fecha] || 0) + 1; }); setProx(o);
  })(); }, [jornadas]);
  return (<>
    <h2 style={{ marginBottom: 10 }}>{perfil.rol === 'jefe' ? 'Mis jornadas' : 'Fichaje'}</h2>
    <div className="row" style={{ marginBottom: 12 }}>
      <div className="field" style={{ maxWidth: 180 }}><label>Día</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      {Object.keys(prox).sort().map(f => <button key={f} className={'btn' + (f === fecha ? ' btn-g' : '')} onClick={() => setFecha(f)}>{new Date(f + 'T00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · {prox[f]}</button>)}
    </div>
    {err && <div className="msg err">{err}</div>}
    {jornadas === null && !err && <div className="muted">Cargando…</div>}
    {jornadas?.length === 0 && <div className="card muted">No hay jornadas asignadas para este día.</div>}
    {jornadas?.map(j => <Jornada key={j.id + j.estado} j={j} trabajadores={trabajadores} onChange={cargar} />)}
  </>);
}
export default function Fichaje() { return <Shell roles={['jefe', 'admin']}>{(p) => <Contenido perfil={p} />}</Shell>; }
