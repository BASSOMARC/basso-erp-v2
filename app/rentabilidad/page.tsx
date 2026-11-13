'use client';
import { useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import Link from 'next/link';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, hoy, todas } from '@/lib/supabase';

type Msg = { t: 'ok' | 'err'; m: string } | null;
const eur = (n: number) => n.toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
const f1 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 1 });
const mes = (y: number, m: number) => [`${y}-${String(m).padStart(2, '0')}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
const vig = (lista: any[], fecha: string) => lista.find(x => x.desde <= fecha);
const nombreMes = (f: string) => new Date(f + 'T00:00').toLocaleString(loc(), { month: 'long', year: 'numeric' });

/* ---------- Mensual: clientes que se facturan ---------- */
function Mensual() {
  const d = new Date();
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1); const [soloVal, setSoloVal] = useState(true);
  const [data, setData] = useState<any>(null); const [err, setErr] = useState(''); const [abierto, setAbierto] = useState<string | null>(null);
  useEffect(() => { (async () => {
    setData(null); setErr('');
    try {
      const [a, b] = mes(y, m);
      const emb = 'tareas(modalidad,cliente_id,servicios(nombre),clientes(nombre,no_facturable))';
      const [lin, cant, coste, prima, tar] = await Promise.all([
        todas((x, z) => sb.from('jornada_trabajador').select(`horas_normal,horas_extra,funcion,trabajadores(tipo),jornadas!inner(id,fecha,estado,${emb})`).is('borrado_en', null).eq('confirmado', true).eq('ausente', false).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)),
        todas((x, z) => sb.from('jornada_cantidad').select(`unidad,cantidad,jornadas!inner(id,fecha,estado,${emb})`).is('borrado_en', null).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)),
        sb.from('coste_hora').select('*').order('desde', { ascending: false }),
        sb.from('prima_porteur').select('*').order('desde', { ascending: false }),
        todas((x, z) => sb.from('tarifas').select('*').order('desde', { ascending: false }).range(x, z)),
      ]);
      if (coste.error) throw coste.error; if (prima.error) throw prima.error;
      setData({ lin, cant, coste: coste.data || [], prima: prima.data || [], tar });
    } catch (e: any) { setErr(e.message); }
  })(); }, [y, m]);

  const res = useMemo(() => {
    if (!data) return null;
    const precio = (cli: string, serv: string, uni: string, fecha: string) => {
      const c = (f: (t: any) => boolean) => vig(data.tar.filter((t: any) => t.unidad === uni && f(t)), fecha);
      return c(t => t.cliente_id === cli && t.servicio === serv) || c(t => t.cliente_id === cli && t.servicio === '*') || c(t => t.cliente_id === null && t.servicio === serv) || c(t => t.cliente_id === null && t.servicio === '*');
    };
    const o: Record<string, any> = {}; let sinCoste = 0, sinTarifa = 0;
    const fila = (j: any) => { const t = j.tareas; const cli = t?.cliente_id || '—'; const serv = t?.servicios?.nombre || 'Sin servicio';
      const c = (o[cli] ||= { nombre: t?.clientes?.nombre || '—', nf: !!t?.clientes?.no_facturable, horas: 0, coste: 0, ingreso: 0, serv: {} as Record<string, any> });
      const s = (c.serv[serv] ||= { horas: 0, coste: 0, ingreso: 0 }); return { c, s, cli, serv, t }; };
    data.lin.forEach((r: any) => { const j = r.jornadas; if (soloVal && j.estado !== 'validada') return; const h = Number(r.horas_normal) + Number(r.horas_extra); const { c, s, cli, serv, t } = fila(j);
      const ch = vig(data.coste.filter((x: any) => x.tipo_trabajador === (r.trabajadores?.tipo || 'peon')), j.fecha) || vig(data.coste.filter((x: any) => x.tipo_trabajador === 'peon'), j.fecha); if (!ch) sinCoste++;
      let cost = h * Number(ch?.euros_hora || 0);
      if (r.funcion === 'porteur') cost += Number(vig(data.prima, j.fecha)?.euros_dia || 0);
      let ing = 0; if (!c.nf && (t?.modalidad === 'hora' || !t?.modalidad)) { const p = precio(cli, serv, 'hora', j.fecha); if (!p) sinTarifa++; ing = h * Number(p?.precio || 0); }
      c.horas += h; s.horas += h; c.coste += cost; s.coste += cost; c.ingreso += ing; s.ingreso += ing; });
    const vistos = new Set<string>();
    data.cant.forEach((r: any) => { const j = r.jornadas; if (soloVal && j.estado !== 'validada') return; const t = j.tareas; if (!t || t.clientes?.no_facturable || (t.modalidad !== 'cepa' && t.modalidad !== 'kg') || r.unidad !== (t.modalidad === 'cepa' ? 'cepas' : 'kg')) return;
      const k = j.id + r.unidad; if (vistos.has(k)) return; vistos.add(k);
      const { c, s, cli, serv } = fila(j); const p = precio(cli, serv, t.modalidad, j.fecha); if (!p) sinTarifa++;
      const ing = Number(r.cantidad) * Number(p?.precio || 0); c.ingreso += ing; s.ingreso += ing; });
    const todos = Object.values(o) as any[];
    const fact = todos.filter(f => !f.nf).sort((a, b) => b.ingreso - a.ingreso); const ferm = todos.filter(f => f.nf).sort((a, b) => b.coste - a.coste);
    const tot = fact.reduce((s: any, f: any) => ({ horas: s.horas + f.horas, coste: s.coste + f.coste, ingreso: s.ingreso + f.ingreso }), { horas: 0, coste: 0, ingreso: 0 });
    const costeFerm = ferm.reduce((s, f) => s + f.coste, 0);
    return { fact, ferm, tot, costeFerm, sinCoste, sinTarifa };
  }, [data, soloVal]);
  const pct = (i: number, c: number) => (i > 0 ? ((i - c) / i * 100) : null);
  const Fila = ({ f, nf }: { f: any; nf?: boolean }) => { const abre = abierto === f.nombre; const p = pct(f.ingreso, f.coste); return (<Fragment>
    <tr style={{ cursor: 'pointer' }} onClick={() => setAbierto(abre ? null : f.nombre)}><td><b>{abre ? '▾' : '▸'} {f.nombre}</b></td><td>{f1(f.horas)}</td><td>{nf ? '—' : eur(f.ingreso)}</td><td>{eur(f.coste)}</td><td style={{ color: !nf && f.ingreso - f.coste < 0 ? 'var(--r)' : 'inherit' }}>{nf ? '—' : eur(f.ingreso - f.coste)}</td><td>{nf || p === null ? '—' : f1(p) + ' %'}</td></tr>
    {abre && Object.entries<any>(f.serv).map(([n, s]) => <tr key={f.nombre + n} className="pend"><td style={{ paddingLeft: 24 }}>{n}</td><td>{f1(s.horas)}</td><td>{nf ? '—' : eur(s.ingreso)}</td><td>{eur(s.coste)}</td><td>{nf ? '—' : eur(s.ingreso - s.coste)}</td><td>{nf || pct(s.ingreso, s.coste) === null ? '—' : f1(pct(s.ingreso, s.coste)!) + ' %'}</td></tr>)}</Fragment>); };
  return (<>
    <div className="card row">
      <div className="field" style={{ maxWidth: 130 }}><label>Mes</label><select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString(loc(), { month: 'long' })}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 110 }}><label>Año</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} /></div>
      <label style={{ margin: 0 }}><input type="checkbox" checked={soloVal} onChange={e => setSoloVal(e.target.checked)} /> Solo jornadas validadas</label>
    </div>
    {err && <div className="msg err">{err}</div>}{!res && !err && <div className="muted">Cargando…</div>}
    {res && (res.sinCoste > 0 || res.sinTarifa > 0) && <div className="msg err">Faltan datos: {res.sinCoste > 0 && <>{res.sinCoste} líneas sin coste por hora definido. </>}{res.sinTarifa > 0 && <>{res.sinTarifa} jornadas sin tarifa de venta (cuentan 0 €). </>}<Link href="/costes" style={{ color: 'inherit', fontWeight: 600 }}>Definirlos en Costes y tarifas →</Link></div>}
    {res && <>
      <div className="kpis">
        <div className="kpi"><div className="kn">{eur(res.tot.ingreso)}</div><div className="kl">Ingreso (clientes que se facturan)</div></div>
        <div className="kpi"><div className="kn">{eur(res.tot.coste)}</div><div className="kl">Coste de esos clientes</div></div>
        <div className="kpi"><div className="kn" style={{ color: res.tot.ingreso - res.tot.coste < 0 ? 'var(--r)' : 'var(--ok)' }}>{eur(res.tot.ingreso - res.tot.coste)}</div><div className="kl">Margen{pct(res.tot.ingreso, res.tot.coste) !== null ? ` · ${f1(pct(res.tot.ingreso, res.tot.coste)!)} %` : ''}</div></div>
        <div className="kpi" style={{ borderLeftColor: 'var(--p)' }}><div className="kn">{eur(res.costeFerm)}</div><div className="kl">Coste fermages (sin factura)</div></div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}><h3>Clientes que se facturan</h3>
        {res.fact.length === 0 ? <div className="muted">Sin datos este mes{soloVal ? ' (prueba a incluir jornadas no validadas)' : ''}.</div> :
          <table><thead><tr><th>Cliente</th><th>Horas</th><th>Ingreso</th><th>Coste</th><th>Margen</th><th>%</th></tr></thead><tbody>{res.fact.map(f => <Fila key={f.nombre} f={f} />)}</tbody></table>}</div>
      {res.ferm.length > 0 && <div className="card" style={{ overflowX: 'auto' }}><h3>Fermages (sin factura: su ingreso es la venta de uva)</h3>
        <table><thead><tr><th>Fermage</th><th>Horas</th><th>Ingreso</th><th>Coste</th><th>Margen</th><th>%</th></tr></thead><tbody>{res.ferm.map(f => <Fila key={f.nombre} f={f} nf />)}</tbody></table>
        <div className="muted" style={{ marginTop: 6 }}>El resultado de cada fermage se ve en la pestaña «Fermages · campaña».</div></div>}
    </>}
  </>);
}

/* ---------- Fermages: coste de la campaña frente a la venta de uva ---------- */
function Fermages() {
  const [camps, setCamps] = useState<any[]>([]); const [camp, setCamp] = useState(''); const [soloVal, setSoloVal] = useState(true);
  const [ferm, setFerm] = useState<any[]>([]); const [costes, setCostes] = useState<any[] | null>(null); const [ventas, setVentas] = useState<any[]>([]); const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [v, setV] = useState({ cliente_id: '', fecha: hoy(), kg: '', importe: '', nota: '' }); const [vm, setVm] = useState<Msg>(null);
  const [nc, setNc] = useState({ nombre: '', desde: '', hasta: '' }); const [cm, setCm] = useState<Msg>(null); const [verCamp, setVerCamp] = useState(false);
  const C = camps.find(c => c.id === camp);

  const cargarBase = useCallback(async () => {
    const [a, b] = await Promise.all([sb.from('campanas').select('*').is('borrado_en', null).order('desde', { ascending: false }), sb.from('clientes').select('id,nombre').eq('no_facturable', true).is('borrado_en', null).order('nombre')]);
    setCamps(a.data || []); setFerm(b.data || []); if (!camp && a.data?.length) setCamp(a.data[0].id);
  }, [camp]);
  useEffect(() => { cargarBase(); }, [cargarBase]);
  const cargar = useCallback(async () => {
    if (!C) return; setCostes(null); setErr('');
    try {
      const [c, vt] = await Promise.all([sb.rpc('rentabilidad_coste', { p_desde: C.desde, p_hasta: C.hasta, p_solo_validadas: soloVal }), sb.from('ventas_uva').select('*').is('borrado_en', null).gte('fecha', C.desde).lte('fecha', C.hasta).order('fecha', { ascending: false })]);
      if (c.error) throw c.error; if (vt.error) throw vt.error;
      setCostes(c.data || []); setVentas(vt.data || []);
    } catch (e: any) { setErr(e.message); }
  }, [C, soloVal]);
  useEffect(() => { cargar(); }, [cargar]);

  const filas = useMemo(() => {
    if (!costes) return [];
    return ferm.map(f => { const cs = costes.filter(x => x.o_cliente_id === f.id).sort((a, b) => a.o_mes.localeCompare(b.o_mes)); const vs = ventas.filter(x => x.cliente_id === f.id);
      const horas = cs.reduce((s, x) => s + Number(x.o_horas), 0); const coste = cs.reduce((s, x) => s + Number(x.o_coste), 0); const ingreso = vs.reduce((s, x) => s + Number(x.importe), 0); const kg = vs.reduce((s, x) => s + Number(x.kg || 0), 0);
      return { ...f, cs, vs, horas, coste, ingreso, kg }; }).sort((a, b) => b.coste - a.coste);
  }, [costes, ventas, ferm]);
  const tot = filas.reduce((s, f) => ({ coste: s.coste + f.coste, ingreso: s.ingreso + f.ingreso, horas: s.horas + f.horas }), { coste: 0, ingreso: 0, horas: 0 });

  const num = (x: string) => Number(String(x).replace(',', '.'));
  async function venta() {
    setVm(null); const imp = num(v.importe); if (!v.cliente_id || v.importe === '' || !(imp >= 0)) { setVm({ t: 'err', m: 'Elige el fermage e indica el importe' }); return; }
    const kg = v.kg === '' ? null : num(v.kg);
    const { data, error } = await sb.from('ventas_uva').insert({ cliente_id: v.cliente_id, fecha: v.fecha, kg, importe: imp, nota: v.nota || null }).select('*').single();
    if (error) { setVm({ t: 'err', m: error.message }); return; }
    if (!data || Number(data.importe) !== imp || (kg !== null && Number(data.kg) !== kg)) { setVm({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return; }
    setVm({ t: 'ok', m: 'Venta registrada ✔' }); setV({ ...v, kg: '', importe: '', nota: '' }); cargar();
  }
  async function anular(x: any) {
    if (!confirm(`¿Anular la venta de ${Number(x.importe).toLocaleString(loc())} € del ${x.fecha}?`)) return;
    const { error } = await sb.from('ventas_uva').update({ borrado_en: new Date().toISOString() }).eq('id', x.id); if (error) alert(error.message); cargar();
  }
  async function crearCamp() {
    setCm(null); if (!nc.nombre.trim() || !nc.desde || !nc.hasta) { setCm({ t: 'err', m: 'Rellena nombre y fechas' }); return; }
    const { error } = await sb.from('campanas').insert({ nombre: nc.nombre.trim(), desde: nc.desde, hasta: nc.hasta }); if (error) { setCm({ t: 'err', m: error.message }); return; }
    setCm({ t: 'ok', m: 'Campaña creada ✔' }); setNc({ nombre: '', desde: '', hasta: '' }); cargarBase();
  }
  return (<>
    <div className="muted" style={{ marginBottom: 10 }}>En los fermages no se factura por horas: el coste se acumula durante la campaña (poda, trabajos y vendimia) y el ingreso llega cuando vendes la uva a la cooperativa. Aquí se comparan las dos cosas.</div>
    <div className="card row">
      <div className="field" style={{ minWidth: 260 }}><label>Campaña</label><select value={camp} onChange={e => setCamp(e.target.value)}>{camps.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
      {C && <div className="muted">{new Date(C.desde + 'T00:00').toLocaleDateString(loc())} → {new Date(C.hasta + 'T00:00').toLocaleDateString(loc())}</div>}
      <label style={{ margin: 0 }}><input type="checkbox" checked={soloVal} onChange={e => setSoloVal(e.target.checked)} /> Solo jornadas validadas</label>
      <button className="btn" onClick={() => setVerCamp(!verCamp)}>{verCamp ? 'Ocultar' : 'Nueva campaña'}</button>
    </div>
    {verCamp && <div className="card"><h3>Nueva campaña</h3>{cm && <div className={'msg ' + cm.t}>{cm.m}</div>}<div className="row">
      <div className="field"><label>Nombre</label><input value={nc.nombre} onChange={e => setNc({ ...nc, nombre: e.target.value })} /></div>
      <div className="field" style={{ maxWidth: 160 }}><label>Desde</label><input type="date" value={nc.desde} onChange={e => setNc({ ...nc, desde: e.target.value })} /></div>
      <div className="field" style={{ maxWidth: 160 }}><label>Hasta</label><input type="date" value={nc.hasta} onChange={e => setNc({ ...nc, hasta: e.target.value })} /></div>
      <button className="btn btn-g" onClick={crearCamp}>Crear</button></div></div>}
    {err && <div className="msg err">{err}</div>}{!costes && !err && <div className="muted">Cargando…</div>}
    {costes && <>
      <div className="kpis">
        <div className="kpi"><div className="kn">{eur(tot.coste)}</div><div className="kl">Coste acumulado de la campaña</div></div>
        <div className="kpi"><div className="kn">{eur(tot.ingreso)}</div><div className="kl">Uva vendida</div></div>
        <div className="kpi"><div className="kn" style={{ color: tot.ingreso - tot.coste < 0 ? 'var(--r)' : 'var(--ok)' }}>{eur(tot.ingreso - tot.coste)}</div><div className="kl">Resultado hasta hoy</div></div>
        <div className="kpi"><div className="kn">{f1(tot.horas)}</div><div className="kl">Horas</div></div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}><h3>Por fermage</h3>
        {filas.length === 0 ? <div className="muted">No hay clientes marcados como fermage. Márcalos en Clientes con «sin factura».</div> :
          <table><thead><tr><th>Fermage</th><th>Horas</th><th>Coste</th><th>Uva vendida</th><th>Resultado</th><th>€/kg</th></tr></thead><tbody>
            {filas.map(f => { const abre = abierto === f.id; return (<Fragment key={f.id}>
              <tr style={{ cursor: 'pointer' }} onClick={() => setAbierto(abre ? null : f.id)}><td><b>{abre ? '▾' : '▸'} {f.nombre}</b></td><td>{f1(f.horas)}</td><td>{eur(f.coste)}</td><td>{eur(f.ingreso)}{f.kg > 0 ? <div className="muted">{f1(f.kg)} kg</div> : null}</td><td style={{ color: f.ingreso - f.coste < 0 ? 'var(--r)' : 'var(--ok)', fontWeight: 600 }}>{eur(f.ingreso - f.coste)}</td><td>{f.kg > 0 ? (f.ingreso / f.kg).toLocaleString(loc(), { maximumFractionDigits: 3 }) : '—'}</td></tr>
              {abre && <>{f.cs.map((x: any) => <tr key={f.id + x.o_mes} className="pend"><td style={{ paddingLeft: 24, textTransform: 'capitalize' }}>{nombreMes(x.o_mes)}</td><td>{f1(Number(x.o_horas))}</td><td>{eur(Number(x.o_coste))}</td><td></td><td></td><td></td></tr>)}
                {f.vs.map((x: any) => <tr key={x.id} className="pend"><td style={{ paddingLeft: 24 }}>Venta {new Date(x.fecha + 'T00:00').toLocaleDateString(loc())}{x.nota ? ' · ' + x.nota : ''}</td><td></td><td></td><td>{eur(Number(x.importe))}{x.kg ? <div className="muted">{f1(Number(x.kg))} kg</div> : null}</td><td><button className="btn" onClick={(e) => { e.stopPropagation(); anular(x); }}>Anular</button></td><td></td></tr>)}</>}</Fragment>); })}
          </tbody></table>}
      </div>
      <div className="card"><h3>Registrar venta de uva</h3>{vm && <div className={'msg ' + vm.t}>{vm.m}</div>}
        <div className="row">
          <div className="field"><label>Fermage</label><select value={v.cliente_id} onChange={e => setV({ ...v, cliente_id: e.target.value })}><option value="">— elegir —</option>{ferm.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select></div>
          <div className="field" style={{ maxWidth: 160 }}><label>Fecha</label><input type="date" value={v.fecha} onChange={e => setV({ ...v, fecha: e.target.value })} /></div>
          <div className="field" style={{ maxWidth: 120 }}><label>Kg (opcional)</label><input type="number" min="0" step="1" value={v.kg} onChange={e => setV({ ...v, kg: e.target.value })} /></div>
          <div className="field" style={{ maxWidth: 140 }}><label>Importe total (€)</label><input type="number" min="0" step="0.01" value={v.importe} onChange={e => setV({ ...v, importe: e.target.value })} /></div>
          <div className="field"><label>Nota</label><input value={v.nota} onChange={e => setV({ ...v, nota: e.target.value })} placeholder="Ej. liquidación cooperativa" /></div>
          <button className="btn btn-g" onClick={venta}>Registrar</button></div></div>
    </>}
  </>);
}

function Contenido() {
  const [tab, setTab] = useState<'mes' | 'ferm'>('mes');
  return (<>
    <h2 style={{ marginBottom: 4 }}>Rentabilidad</h2>
    <div className="muted" style={{ marginBottom: 10 }}>Solo administradores. Coste = horas × coste por hora vigente + prima de porteur.</div>
    <div className="row" style={{ marginBottom: 12 }}>
      <button className={'btn' + (tab === 'mes' ? ' btn-g' : '')} onClick={() => setTab('mes')}>Mensual · clientes que se facturan</button>
      <button className={'btn' + (tab === 'ferm' ? ' btn-g' : '')} onClick={() => setTab('ferm')}>Fermages · campaña</button></div>
    {tab === 'mes' ? <Mensual /> : <Fermages />}
  </>);
}
export default function Page() { return <Shell roles={['admin']}>{() => <Contenido />}</Shell>; }
