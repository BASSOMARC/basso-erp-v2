'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, Perfil } from '@/lib/supabase';
import { useT, loc } from '@/lib/i18n';
const hoy = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const mas = (f: string, n: number) => new Date(new Date(f + 'T12:00').getTime() + n * 864e5).toISOString().slice(0, 10);

type Est = 'pend' | 'pres' | 'aus';
type Linea = { trabajador_id: string; nombre: string; h: string; he: string; est: Est; funcion: string | null; asignado: boolean; fh?: string | null };
type Msg = { t: 'ok' | 'err'; m: string } | null;
const num = (v: string) => (v === '' ? 0 : Number(String(v).replace(',', '.')));
const TIPOS = ['accidente', 'retraso', 'material', 'clima', 'cliente', 'otra'];

function Incidencias({ j, lineas, editable }: any) {
  const { t } = useT();
  const [lista, setLista] = useState<any[]>((j.incidencias || []).filter((i: any) => !i.borrado_en));
  const [tipo, setTipo] = useState('otra'); const [tr, setTr] = useState(''); const [d, setD] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [abierto, setAbierto] = useState(false); const [busy, setBusy] = useState(false);
  async function crear() {
    setMsg(null); if (d.trim().length < 3) { setMsg({ t: 'err', m: t('incDescribe') }); return; }
    setBusy(true);
    const { data, error } = await sb.from('incidencias').insert({ jornada_id: j.id, tipo, descripcion: d.trim(), trabajador_id: tr || null }).select('id,tipo,descripcion,estado,trabajador_id').single();
    setBusy(false);
    if (error || !data) { setMsg({ t: 'err', m: t('notSaved') + (error?.message || t('noReply')) }); return; }
    setLista(l => [...l, data]); setD(''); setTr(''); setTipo('otra'); setAbierto(false);
  }
  return (<div style={{ marginTop: 14 }}>
    {lista.map(i => <div key={i.id} className={'inc' + (i.estado === 'resuelta' ? ' res' : '')}><b>{t('t_' + i.tipo)}</b>{i.trabajador_id ? ' · ' + (lineas.find((l: Linea) => l.trabajador_id === i.trabajador_id)?.nombre || '') : ''}: {i.descripcion} <span className="muted">({i.estado === 'resuelta' ? t('resolved') : t('sentAdmin')})</span></div>)}
    {lista.length > 0 && !abierto && <div className="msg ok" style={{ marginTop: 6 }}>{t('incSent')}</div>}
    {editable && !abierto && <button className="btn btn-lg btn-warn" onClick={() => setAbierto(true)}>{t('reportBtn')}</button>}
    {editable && abierto && <div className="card" style={{ background: 'var(--bg2)', marginTop: 8 }}>
      <h3>{t('whatHappened')}</h3>
      {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
      <div className="chipgrid">{TIPOS.map(k => <button key={k} type="button" className={'btn' + (tipo === k ? ' btn-g' : '')} onClick={() => setTipo(k)}>{t('t_' + k)}</button>)}</div>
      <div className="field" style={{ marginTop: 10 }}><label>{t('withWhom')}</label><select value={tr} onChange={e => setTr(e.target.value)}><option value="">{t('nobody')}</option>{lineas.map((l: Linea) => <option key={l.trabajador_id} value={l.trabajador_id}>{l.nombre}</option>)}</select></div>
      <div style={{ marginTop: 10 }}><label>{t('tellIt')}</label><textarea rows={3} value={d} onChange={e => setD(e.target.value)} placeholder={t('incPh')} /></div>
      <div className="row" style={{ marginTop: 10 }}><button className="btn btn-lg btn-g" disabled={busy} onClick={crear}>{t('sendReport')}</button><button className="btn btn-lg" onClick={() => { setAbierto(false); setMsg(null); }}>{t('cancel')}</button></div>
    </div>}
  </div>);
}

function Jornada({ j, trabajadores, onChange }: any) {
  const { t, lang } = useT();
  const editable = j.estado !== 'validada';
  const [lineas, setLineas] = useState<Linea[]>(() => (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en).map((l: any) => ({
    trabajador_id: l.trabajador_id, nombre: l.trabajadores?.nombre || '?', h: l.horas_normal ? String(l.horas_normal) : '', he: l.horas_extra ? String(l.horas_extra) : '',
    est: !l.confirmado ? 'pend' : l.ausente ? 'aus' : 'pres', funcion: l.funcion, asignado: l.asignado, fh: l.trabajadores?.funcion_habitual || null })).sort((a: Linea, b: Linea) => a.nombre.localeCompare(b.nombre)));
  const modalidad = j.tareas?.modalidad || 'hora';
  const porUnidad = modalidad === 'cepa' || modalidad === 'kg';
  const cant0 = (j.jornada_cantidad || []).find((c: any) => !c.borrado_en);
  const [unidad, setUnidad] = useState(cant0?.unidad || (modalidad === 'kg' ? 'kg' : 'cepas'));
  const [cant, setCant] = useState(cant0 ? String(cant0.cantidad) : '');
  const [nuevo, setNuevo] = useState(''); const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const [obs, setObs] = useState<string>(j.observaciones || '');
  const proy = j.tareas?.proyectos || null; const porPct = proy?.unidad_avance === 'porcentaje';
  const [av, setAv] = useState<any>(null); const [pct, setPct] = useState<string>(j.avance_pct != null ? String(j.avance_pct) : '');
  useEffect(() => { if (!j.tareas?.proyecto_id) return; sb.rpc('proyecto_avance', { p_proyecto: j.tareas.proyecto_id }).then(({ data }) => { const a = data?.[0] || null; setAv(a); if (a && j.avance_pct == null && porPct && j.estado === 'planificada') setPct(a.avance ? String(a.avance) : ''); }); }, []);
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
          throw new Error(t('srvMismatch'));
      }
      if (cant !== '') { const { data: c } = await sb.from('jornada_cantidad').select('cantidad').eq('jornada_id', j.id).eq('unidad', unidad).is('borrado_en', null).maybeSingle(); if (!c || Number(c.cantidad) !== num(cant)) throw new Error(t('qtyMismatch')); }
      if (porPct && pct !== '' && Number(pct) !== Number(j.avance_pct ?? -1)) {
        const v = Math.max(0, Math.min(100, num(pct)));
        const { error: ep } = await sb.from('jornadas').update({ avance_pct: v }).eq('id', j.id); if (ep) throw new Error(ep.message);
        const { data: pp } = await sb.from('jornadas').select('avance_pct').eq('id', j.id).single(); if (!pp || Number(pp.avance_pct) !== v) throw new Error(t('pctMismatch'));
        j.avance_pct = v; setPct(String(v));
      }
      if (obs !== (j.observaciones || '')) {
        const { error: eo } = await sb.from('jornadas').update({ observaciones: obs.trim() || null }).eq('id', j.id); if (eo) throw new Error(eo.message);
        const { data: o } = await sb.from('jornadas').select('observaciones').eq('id', j.id).single(); if ((o?.observaciones || '') !== obs.trim()) throw new Error(t('notesMismatch'));
        j.observaciones = obs.trim() || null; setObs(obs.trim());
      }
      try { localStorage.removeItem(clave); } catch {} setBorr(false); setMsg({ t: 'ok', m: t('savedOk') }); return true;
    } catch (e: any) { setMsg({ t: 'err', m: t('notSaved') + e.message }); return false; }
    finally { setBusy(false); }
  }
  async function fichar() {
    if (pend) { setMsg({ t: 'err', m: t('needPres', { n: pend }) }); return; }
    if (!lineas.length) { setMsg({ t: 'err', m: t('missWorker') }); return; }
    if (lineas.some(l => l.est === 'pres' && num(l.h) + num(l.he) <= 0)) { setMsg({ t: 'err', m: t('presNoHours') }); return; }
    if (porPct && (pct === '' || num(pct) <= 0)) { setMsg({ t: 'err', m: t('missPct') }); return; }
    if (porUnidad && num(cant) <= 0) { setMsg({ t: 'err', m: t(modalidad === 'cepa' ? 'needQtyV' : 'needQtyK') }); return; }
    if (!(await guardar())) return;
    setBusy(true);
    const { data, error } = await sb.from('jornadas').update({ estado: 'fichada' }).eq('id', j.id).select('id,estado');
    setBusy(false);
    if (error || !data?.length || data[0].estado !== 'fichada') { setMsg({ t: 'err', m: t('cantSend') + (error?.message || t('noChanges')) }); return; }
    setMsg({ t: 'ok', m: t('sentMsg') }); onChange();
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
  const cantOk = (!porUnidad || num(cant) > 0) && (!porPct || (pct !== '' && num(pct) > 0));
  const falta = !asistOk ? (lineas.length ? t('missConfirm', { n: pend }) : t('missWorker')) : !horasOk ? t('missHours') : !cantOk ? (porPct && (pct === '' || num(pct) <= 0) ? t('missPct') : t(modalidad === 'cepa' ? 'missQtyV' : 'missQtyK')) : '';
  const presentes = lineas.filter(l => l.est === 'pres').length; const ausentes = lineas.filter(l => l.est === 'aus').length;
  const clave = 'borrador-' + j.id; const [borr, setBorr] = useState(false); const [listo, setListo] = useState(false);
  useEffect(() => { if (!editable) { setListo(true); return; } try { const r = localStorage.getItem(clave); if (r) { const d = JSON.parse(r); if (Array.isArray(d.lineas) && d.lineas.length && lineas.every(l => d.lineas.some((x: any) => x.trabajador_id === l.trabajador_id))) { setLineas(d.lineas); setCant(d.cant ?? ''); setObs(d.obs ?? ''); if (d.pct) setPct(d.pct); setBorr(true); } } } catch {} setListo(true); }, []);
  useEffect(() => { if (!listo || !editable) return; try { localStorage.setItem(clave, JSON.stringify({ lineas, cant, obs, pct })); } catch {} }, [lineas, cant, obs, pct, listo]);
  const todosPresentes = () => setLineas(ls => ls.map(l => l.est === 'pend' ? { ...l, est: 'pres', h: l.h || '7', funcion: vendimia ? (l.funcion || l.fh || 'coupeur') : l.funcion } : l));
  const paso = (i: number, d: number) => set(i, { h: String(Math.max(0, Math.min(24, (num(lineas[i].h) || 0) + d))) });

  return (<div className="card jcard">
    <div className="jhead">
      <div><div className="jt">{j.tareas?.nombre}</div><div className="jc">{j.tareas?.clientes?.nombre}</div>
        <div className="muted">{modalidad === 'hora' ? t('byHour') : modalidad === 'cepa' ? t('byVine') : t('byKg')}{j.perfiles?.nombre ? ' · ' + t('chief') + ': ' + j.perfiles.nombre : ''}</div></div>
      <span className={'badge ' + (j.estado === 'validada' ? 'b-va' : j.estado === 'fichada' ? 'b-fi' : 'b-pl')}>{t('st_' + j.estado)}</span>
    </div>
    {proy && <div className="pbox"><div className="pn">📍 {t('project')}: <b>{proy.nombre}</b></div>
      {av && av.pct != null ? <><div className="pbar"><i style={{ width: Math.min(100, Number(av.pct)) + '%' }} /></div><div className="muted">{av.unidad === 'porcentaje' ? `${Number(av.pct).toLocaleString(lang)} %` : `${Number(av.avance).toLocaleString(lang)} / ${Number(av.objetivo).toLocaleString(lang)} ${av.unidad} · ${Number(av.pct).toLocaleString(lang)} %`} {t('doneSoFar')}</div></> : av ? <div className="muted">{Number(av.avance).toLocaleString(lang)} {av.unidad} {t('doneSoFar')}</div> : null}</div>}
    {j.estado !== 'planificada' && <div className="msg ok" style={{ marginTop: 10 }}><b>{j.estado === 'validada' ? t('doneValidated') : t('doneSent')}</b> · {presentes} {presentes === 1 ? t('person') : t('people')} · {total} h{porUnidad && cant ? ` · ${Number(num(cant)).toLocaleString(loc())} ${unidad}` : ''}{j.estado === 'fichada' ? t('pendingValidate') : t('askAdminFix')}</div>}
    {borr && editable && <div className="msg err" style={{ marginTop: 10 }}>{t('draftBack')}</div>}
    {msg && <div className={'msg ' + msg.t} style={{ marginTop: 10 }}>{msg.m}</div>}
    {editable && <div className="steps">
      <div className={'step' + (asistOk ? ' ok' : '')}><i>{asistOk ? '✓' : '1'}</i>{t('s_att')}</div>
      <div className={'step' + (horasOk ? ' ok' : '')}><i>{horasOk ? '✓' : '2'}</i>{t('s_hours')}</div>
      {porUnidad || porPct ? <div className={'step' + (cantOk ? ' ok' : '')}><i>{cantOk ? '✓' : '3'}</i>{porPct ? t('s_progress') : modalidad === 'cepa' ? t('s_vines') : t('s_kg')}</div> : <div className="step ok"><i>✓</i>{t('s_none')}</div>}
    </div>}
    {editable && pend > 0 && <button type="button" className="btn btn-lg btn-ok on" style={{ width: '100%', marginTop: 10 }} onClick={todosPresentes}>{t('allPresent')}</button>}
    <div style={{ marginTop: 10 }}>{lineas.map((l, i) => (<div key={l.trabajador_id} className={'wrow' + (l.est === 'pend' ? ' pend' : '')}>
      <div className="wname">{l.nombre}{!l.asignado && <span className="muted">{t('addedByYou')}</span>}{editable && !l.asignado && <button className="btn" style={{ marginLeft: 8 }} onClick={() => quitar(i)}>{t('remove')}</button>}</div>
      <div className="wbtns">
        <button type="button" disabled={!editable} className={'btn btn-ok' + (l.est === 'pres' ? ' on' : '')} onClick={() => set(i, { est: 'pres', h: l.h || '7', funcion: vendimia ? (l.funcion || l.fh || 'coupeur') : l.funcion })}>{t('present')}</button>
        <button type="button" disabled={!editable} className={'btn btn-no' + (l.est === 'aus' ? ' on' : '')} onClick={() => set(i, { est: 'aus' })}>{t('absent')}</button>
      </div>
      {l.est === 'pres' && <div className="wnums">
        <div className="stepper"><label>{t('hours')}</label>
          <div className="stp"><button type="button" disabled={!editable} onClick={() => paso(i, -0.5)}>−</button>
            <input type="number" step="0.25" min="0" max="24" inputMode="decimal" disabled={!editable} value={l.h} onChange={e => set(i, { h: e.target.value })} />
            <button type="button" disabled={!editable} onClick={() => paso(i, 0.5)}>+</button></div></div>
        {vendimia && <div style={{ flex: 1 }}><label>{t('role')}</label><button type="button" disabled={!editable} className={'btn btn-p' + (l.funcion === 'porteur' ? ' on' : '')} onClick={() => set(i, { funcion: l.funcion === 'porteur' ? 'coupeur' : 'porteur' })}>{l.funcion === 'porteur' ? t('porteur') : t('cutter')}</button></div>}
        {num(l.he) > 0 && <div className="muted" style={{ alignSelf: 'center' }}>+ {l.he} {t('extraH')}</div>}
      </div>}
    </div>))}</div>
    {editable && <div className="row" style={{ marginTop: 4 }}>
      <div className="field"><select value={nuevo} onChange={e => setNuevo(e.target.value)}><option value="">{t('someoneElse')}</option>{disponibles.map((t: any) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
      <button className="btn" disabled={!nuevo} onClick={() => { const t = trabajadores.find((x: any) => x.id === nuevo); setLineas(ls => [...ls, { trabajador_id: t.id, nombre: t.nombre, h: '7', he: '', est: 'pres', aus: false, funcion: vendimia ? (t.funcion_habitual || 'coupeur') : null, asignado: false, fh: t.funcion_habitual || null } as any]); setNuevo(''); }}>{t('add')}</button>
    </div>}
    {porUnidad && <div className="cbox"><label>{modalidad === 'cepa' ? t('vinesToday') : t('kgToday')}</label>
      <input type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={cant} onChange={e => setCant(e.target.value)} placeholder="0" /></div>}
    {porPct && <div className="cbox"><label>{t('pctTotal')}</label>
      <input type="number" min="0" max="100" step="1" inputMode="numeric" disabled={!editable} value={pct} onChange={e => setPct(e.target.value)} placeholder="0" />
      <div className="muted" style={{ marginTop: 4 }}>{t('pctHelp')}</div></div>}
    {!porUnidad && <div className="row" style={{ marginTop: 10 }}><div className="field" style={{ maxWidth: 220 }}><label>{t('qtyOpt')}</label><input type="number" min="0" step="1" inputMode="numeric" disabled={!editable} value={cant} onChange={e => setCant(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 110 }}><label>{t('unit')}</label><select disabled={!editable} value={unidad} onChange={e => setUnidad(e.target.value)}><option value="cepas">{t('vinesU')}</option><option value="kg">kg</option></select></div></div>}
    <div style={{ marginTop: 12 }}><label>{t('notes')}</label>
      <textarea rows={2} maxLength={2000} disabled={!editable} value={obs} onChange={e => setObs(e.target.value)} placeholder={t('notesPh')} /></div>
    <Incidencias j={j} lineas={lineas} editable={editable} />
    {editable && <div className="sbar">
      <div className="sinfo">{falta ? <span style={{ color: 'var(--a)' }}>⚠ {falta}</span> : <span style={{ color: 'var(--ok)' }}>{t('allReady')}</span>}<span className="muted"> · {presentes} {t('presents')}{ausentes ? ` · ${ausentes} ${t('absents')}` : ''} · <b>{total} h</b>{porUnidad && cant ? ` · ${Number(num(cant)).toLocaleString(loc())} ${unidad}` : ''}</span></div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button className="btn btn-lg" disabled={busy} onClick={guardar}>{t('save')}</button>
        {j.estado === 'planificada' && <button className="btn btn-g btn-lg" style={{ flex: 1 }} disabled={busy || !!falta} onClick={fichar}>{t('sendDay')}</button>}
      </div>
    </div>}
  </div>);
}

function Contenido({ perfil }: { perfil: Perfil }) {
  const { t, lang } = useT();
  const [fecha, setFecha] = useState(hoy());
  const [jornadas, setJornadas] = useState<any[] | null>(null); const [trabajadores, setTrabajadores] = useState<any[]>([]); const [prox, setProx] = useState<Record<string, number>>({}); const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    setJornadas(null); setErr('');
    const { data, error } = await sb.from('jornadas')
      .select('id,fecha,estado,observaciones,avance_pct,perfiles:jefe_id(nombre),tareas(nombre,temporada,modalidad,proyecto_id,proyectos(nombre,unidad_avance,cantidad_objetivo),clientes(nombre)),jornada_trabajador(trabajador_id,horas_normal,horas_extra,ausente,funcion,borrado_en,confirmado,asignado,trabajadores(nombre,funcion_habitual)),jornada_cantidad(unidad,cantidad,borrado_en),incidencias(id,tipo,descripcion,estado,trabajador_id,borrado_en)')
      .eq('fecha', fecha).is('borrado_en', null).order('creado_en');
    if (error) { setErr(error.message); return; }
    setJornadas(data || []);
  }, [fecha]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { sb.from('trabajadores').select('id,nombre,funcion_habitual').eq('estado', 'activo').is('borrado_en', null).order('nombre').then(({ data }) => setTrabajadores(data || [])); }, []);
  useEffect(() => { (async () => {
    const { data } = await sb.from('jornadas').select('fecha').is('borrado_en', null).gte('fecha', hoy()).lte('fecha', new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)).eq('estado', 'planificada');
    const o: Record<string, number> = {}; (data || []).forEach((r: any) => { o[r.fecha] = (o[r.fecha] || 0) + 1; }); setProx(o);
  })(); }, [jornadas]);
  return (<>
    <h2 style={{ marginBottom: 10 }}>{perfil.rol === 'jefe' ? t('myDays') : t('pointage')}</h2>
    <div className="row" style={{ marginBottom: 12 }}>
      {[[-1, 'yesterday'], [0, 'today'], [1, 'tomorrow']].map(([n, k]: any) => <button key={k} className={'btn btn-lg' + (fecha === mas(hoy(), n) ? ' btn-g' : '')} onClick={() => setFecha(mas(hoy(), n))}>{t(k)}</button>)}
      <div className="field" style={{ maxWidth: 170 }}><input type="date" aria-label={t('otherDay')} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      {Object.keys(prox).sort().filter(f => f !== hoy() && f !== mas(hoy(), 1)).map(f => <button key={f} className={'btn' + (f === fecha ? ' btn-g' : '')} onClick={() => setFecha(f)}>{new Date(f + 'T00:00').toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' })} · {prox[f]}</button>)}
    </div>
    {err && <div className="msg err">{err}</div>}
    {jornadas === null && !err && <div className="muted">{t('loading')}</div>}
    {jornadas?.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 24 }}><div style={{ fontSize: 28 }}>🌿</div><b>{t('noDays')}</b><div className="muted" style={{ marginTop: 4 }}>{t('noDaysSub')}</div></div>}
    {jornadas?.map(j => <Jornada key={j.id + j.estado} j={j} trabajadores={trabajadores} onChange={cargar} />)}
  </>);
}
export default function Fichaje() { return <Shell roles={['jefe', 'admin']}>{(p) => <Contenido perfil={p} />}</Shell>; }
