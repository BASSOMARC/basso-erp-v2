'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, Perfil } from '@/lib/supabase';
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const mas = (f: string, n: number) => new Date(new Date(f + 'T12:00').getTime() + n * 864e5).toISOString().slice(0, 10);

type Est = 'pend' | 'pres' | 'aus';
type Linea = { trabajador_id: string; nombre: string; h: string; he: string; est: Est; funcion: string | null; asignado: boolean };
type Msg = { t: 'ok' | 'err'; m: string } | null;
const num = (v: string) => (v === '' ? 0 : Number(String(v).replace(',', '.')));
const TIPOS: Record<string, string> = { accidente: 'Accidente', retraso: 'Retraso', material: 'Falta de material', clima: 'Clima', cliente: 'Cliente', otra: 'Otra' };

function Incidencias({ j, lineas, editable }: any) {
  const [lista, setLista] = useState<any[]>((j.incidencias || []).filter((i: any) => !i.borrado_en));
  const [tipo, setTipo] = useState('otra'); const [tr, setTr] = useState(''); const [d, setD] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [abierto, setAbierto] = useState(false); const [busy, setBusy] = useState(false);
  async function crear() {
    setMsg(null); if (d.trim().length < 3) { setMsg({ t: 'err', m: 'Cuenta brevemente qué ha pasado' }); return; }
    setBusy(true);
    const { data, error } = await sb.from('incidencias').insert({ jornada_id: j.id, tipo, descripcion: d.trim(), trabajador_id: tr || null }).select('id,tipo,descripcion,estado,trabajador_id').single();
    setBusy(false);
    if (error || !data) { setMsg({ t: 'err', m: 'No se guardó: ' + (error?.message || 'sin respuesta') }); return; }
    setLista(l => [...l, data]); setD(''); setTr(''); setTipo('otra'); setAbierto(false);
  }
  return (<div style={{ marginTop: 14 }}>
    {lista.map(i => <div key={i.id} className={'inc' + (i.estado === 'resuelta' ? ' res' : '')}><b>{TIPOS[i.tipo]}</b>{i.trabajador_id ? ' · ' + (lineas.find((l: Linea) => l.trabajador_id === i.trabajador_id)?.nombre || '') : ''}: {i.descripcion} <span className="muted">({i.estado === 'resuelta' ? 'resuelta' : 'enviada al administrador'})</span></div>)}
    {lista.length > 0 && !abierto && <div className="msg ok" style={{ marginTop: 6 }}>Reporte enviado ✔ El administrador lo verá.</div>}
    {editable && !abierto && <button className="btn btn-lg btn-warn" onClick={() => setAbierto(true)}>⚠ Reportar un problema</button>}
    {editable && abierto && <div className="card" style={{ background: 'var(--bg2)', marginTop: 8 }}>
      <h3>¿Qué ha pasado?</h3>
      {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
      <div className="chipgrid">{Object.entries(TIPOS).map(([k, v]) => <button key={k} type="button" className={'btn' + (tipo === k ? ' btn-g' : '')} onClick={() => setTipo(k)}>{v}</button>)}</div>
      <div className="field" style={{ marginTop: 10 }}><label>¿Con quién? (opcional)</label><select value={tr} onChange={e => setTr(e.target.value)}><option value="">— nadie en concreto —</option>{lineas.map((l: Linea) => <option key={l.trabajador_id} value={l.trabajador_id}>{l.nombre}</option>)}</select></div>
      <div style={{ marginTop: 10 }}><label>Cuéntalo con tus palabras</label><textarea rows={3} value={d} onChange={e => setD(e.target.value)} placeholder="Ej. se rompió una tijera, llovió desde las 11…" /></div>
      <div className="row" style={{ marginTop: 10 }}><button className="btn btn-lg btn-g" disabled={busy} onClick={crear}>Enviar reporte</button><button className="btn btn-lg" onClick={() => { setAbierto(false); setMsg(null); }}>Cancelar</button></div>
    </div>}
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
      try { localStorage.removeItem(clave); } catch {} setBorr(false); setMsg({ t: 'ok', m: 'Guardado y verificado en el servidor ✔' }); return true;
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
  const asistOk = lineas.length > 0 && pend === 0;
  const horasOk = asistOk && lineas.some(l => l.est === 'pres') && lineas.every(l => l.est !== 'pres' || num(l.h) + num(l.he) > 0);
  const cantOk = !porUnidad || num(cant) > 0;
  const falta = !asistOk ? (lineas.length ? `Faltan ${pend} por confirmar` : 'Añade al menos un trabajador') : !horasOk ? 'Faltan las horas de algún presente' : !cantOk ? `Falta el total de ${modalidad === 'cepa' ? 'cepas' : 'kg'} del equipo` : '';
  const presentes = lineas.filter(l => l.est === 'pres').length; const ausentes = lineas.filter(l => l.est === 'aus').length;
  const clave = 'borrador-' + j.id; const [borr, setBorr] = useState(false); const [listo, setListo] = useState(false);
  useEffect(() => { if (!editable) { setListo(true); return; } try { const r = localStorage.getItem(clave); if (r) { const d = JSON.parse(r); if (Array.isArray(d.lineas) && d.lineas.length && lineas.every(l => d.lineas.some((x: any) => x.trabajador_id === l.trabajador_id))) { setLineas(d.lineas); setCant(d.cant ?? ''); setObs(d.obs ?? ''); setBorr(true); } } } catch {} setListo(true); }, []);
  useEffect(() => { if (!listo || !editable) return; try { localStorage.setItem(clave, JSON.stringify({ lineas, cant, obs })); } catch {} }, [lineas, cant, obs, listo]);
  const todosPresentes = () => setLineas(ls => ls.map(l => l.est === 'pend' ? { ...l, est: 'pres', h: l.h || '7', funcion: vendimia ? (l.funcion || 'coupeur') : l.funcion } : l));
  const paso = (i: number, d: number) => set(i, { h: String(Math.max(0, Math.min(24, (num(lineas[i].h) || 0) + d))) });

  return (<div className="card jcard">
    <div className="jhead">
      <div><div className="jt">{j.tareas?.nombre}</div><div className="jc">{j.tareas?.clientes?.nombre}</div>
        <div className="muted">{modalidad === 'hora' ? 'Trabajo por horas' : modalidad === 'cepa' ? 'Trabajo por cepa' : 'Trabajo por kg'}{j.perfiles?.nombre ? ' · Jefe: ' + j.perfiles.nombre : ''}</div></div>
      <span className={'badge ' + (j.estado === 'validada' ? 'b-va' : j.estado === 'fichada' ? 'b-fi' : 'b-pl')}>{j.estado === 'planificada' ? 'por hacer' : j.estado === 'fichada' ? 'enviada' : 'validada'}</span>
    </div>
    {j.estado !== 'planificada' && <div className="msg ok" style={{ marginTop: 10 }}><b>{j.estado === 'validada' ? 'Jornada validada ✔' : 'Jornada enviada ✔'}</b> · {presentes} {presentes === 1 ? 'persona' : 'personas'} · {total} h{porUnidad && cant ? ` · ${Number(num(cant)).toLocaleString('es')} ${unidad}` : ''}{j.estado === 'fichada' ? ' · pendiente de validar por el administrador. Si corriges algo, pulsa Guardar.' : ' · para corregir algo, avisa a un administrador.'}</div>}
    {borr && editable && <div className="msg err" style={{ marginTop: 10 }}>Recuperé lo que habías escrito y no estaba guardado. Revísalo y pulsa Guardar.</div>}
    {msg && <div className={'msg ' + msg.t} style={{ marginTop: 10 }}>{msg.m}</div>}
    {editable && <div className="steps">
      <div className={'step' + (asistOk ? ' ok' : '')}><i>{asistOk ? '✓' : '1'}</i>Asistencia</div>
      <div className={'step' + (horasOk ? ' ok' : '')}><i>{horasOk ? '✓' : '2'}</i>Horas</div>
      {porUnidad ? <div className={'step' + (cantOk ? ' ok' : '')}><i>{cantOk ? '✓' : '3'}</i>{modalidad === 'cepa' ? 'Cepas' : 'Kg'}</div> : <div className="step ok"><i>✓</i>Sin cantidad</div>}
    </div>}
    {editable && pend > 0 && <button type="button" className="btn btn-lg btn-ok on" style={{ width: '100%', marginTop: 10 }} onClick={todosPresentes}>✓ Todos presentes · 7 h</button>}
    <div style={{ marginTop: 10 }}>{lineas.map((l, i) => (<div key={l.trabajador_id} className={'wrow' + (l.est === 'pend' ? ' pend' : '')}>
      <div className="wname">{l.nombre}{!l.asignado && <span className="muted"> · añadido por ti</span>}{editable && !l.asignado && <button className="btn" style={{ marginLeft: 8 }} onClick={() => quitar(i)}>Quitar</button>}</div>
      <div className="wbtns">
        <button type="button" disabled={!editable} className={'btn btn-ok' + (l.est === 'pres' ? ' on' : '')} onClick={() => set(i, { est: 'pres', h: l.h || '7', funcion: vendimia ? (l.funcion || 'coupeur') : l.funcion })}>✓ Presente</button>
        <button type="button" disabled={!editable} className={'btn btn-no' + (l.est === 'aus' ? ' on' : '')} onClick={() => set(i, { est: 'aus' })}>✗ Ausente</button>
      </div>
      {l.est === 'pres' && <div className="wnums">
        <div className="stepper"><label>Horas</label>
          <div className="stp"><button type="button" disabled={!editable} onClick={() => paso(i, -0.5)}>−</button>
            <input type="number" step="0.25" min="0" max="24" inputMode="decimal" disabled={!editable} value={l.h} onChange={e => set(i, { h: e.target.value })} />
            <button type="button" disabled={!editable} onClick={() => paso(i, 0.5)}>+</button></div></div>
        {vendimia && <div style={{ flex: 1 }}><label>Función</label><button type="button" disabled={!editable} className={'btn btn-p' + (l.funcion === 'porteur' ? ' on' : '')} onClick={() => set(i, { funcion: l.funcion === 'porteur' ? 'coupeur' : 'porteur' })}>{l.funcion === 'porteur' ? 'Porteur' : 'Cortador'}</button></div>}
        {num(l.he) > 0 && <div className="muted" style={{ alignSelf: 'center' }}>+ {l.he} h extra</div>}
      </div>}
    </div>))}</div>
    {editable && <div className="row" style={{ marginTop: 4 }}>
      <div className="field"><select value={nuevo} onChange={e => setNuevo(e.target.value)}><option value="">+ Ha venido otra persona…</option>{disponibles.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
      <button className="btn" disabled={!nuevo} onClick={() => { const t = trabajadores.find((x: any) => x.id === nuevo); setLineas(ls => [...ls, { trabajador_id: t.id, nombre: t.nombre, h: '7', he: '', est: 'pres', aus: false, funcion: vendimia ? 'coupeur' : null, asignado: false } as any]); setNuevo(''); }}>Añadir</button>
    </div>}
    {porUnidad && <div className="cbox"><label>{modalidad === 'cepa' ? 'Cepas hechas hoy por todo el equipo' : 'Kg hechos hoy por todo el equipo'}</label>
      <input type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={cant} onChange={e => setCant(e.target.value)} placeholder="0" /></div>}
    {!porUnidad && <div className="row" style={{ marginTop: 10 }}><div className="field" style={{ maxWidth: 220 }}><label>Cantidad realizada (opcional)</label><input type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={cant} onChange={e => setCant(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 110 }}><label>Unidad</label><select disabled={!editable} value={unidad} onChange={e => setUnidad(e.target.value)}><option value="cepas">cepas</option><option value="kg">kg</option></select></div></div>}
    <div style={{ marginTop: 12 }}><label>Notas de la jornada (opcional)</label>
      <textarea rows={2} maxLength={2000} disabled={!editable} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ej. parcela terminada, falta la fila 12…" /></div>
    <Incidencias j={j} lineas={lineas} editable={editable} />
    {editable && <div className="sbar">
      <div className="sinfo">{falta ? <span style={{ color: 'var(--a)' }}>⚠ {falta}</span> : <span style={{ color: 'var(--ok)' }}>✓ Todo listo</span>}<span className="muted"> · {presentes} presentes{ausentes ? ` · ${ausentes} ausentes` : ''} · <b>{total} h</b>{porUnidad && cant ? ` · ${Number(num(cant)).toLocaleString('es')} ${unidad}` : ''}</span></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button className="btn btn-lg" disabled={busy} onClick={guardar}>Guardar</button>
        {j.estado === 'planificada' && <button className="btn btn-g btn-lg" style={{ flex: 1 }} disabled={busy || !!falta} onClick={fichar}>Fichar jornada</button>}
      </div>
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
      {[[-1, 'Ayer'], [0, 'Hoy'], [1, 'Mañana']].map(([n, t]: any) => <button key={t} className={'btn btn-lg' + (fecha === mas(hoy(), n) ? ' btn-g' : '')} onClick={() => setFecha(mas(hoy(), n))}>{t}</button>)}
      <div className="field" style={{ maxWidth: 170 }}><input type="date" aria-label="Otro día" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      {Object.keys(prox).sort().filter(f => f !== hoy() && f !== mas(hoy(), 1)).map(f => <button key={f} className={'btn' + (f === fecha ? ' btn-g' : '')} onClick={() => setFecha(f)}>{new Date(f + 'T00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · {prox[f]}</button>)}
    </div>
    {err && <div className="msg err">{err}</div>}
    {jornadas === null && !err && <div className="muted">Cargando…</div>}
    {jornadas?.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 24 }}><div style={{ fontSize: 28 }}>🌿</div><b>No tienes jornadas para este día.</b><div className="muted" style={{ marginTop: 4 }}>Cuando el administrador te asigne una, aparecerá aquí con tu equipo.</div></div>}
    {jornadas?.map(j => <Jornada key={j.id + j.estado} j={j} trabajadores={trabajadores} onChange={cargar} />)}
  </>);
}
export default function Fichaje() { return <Shell roles={['jefe', 'admin']}>{(p) => <Contenido perfil={p} />}</Shell>; }
