'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, hoy, todas } from '@/lib/supabase';

type Msg = { t: 'ok' | 'err'; m: string } | null;
const TIPO: Record<string, string> = { peon: 'Peón', vendimiador: 'Vendimiador', jefe: 'Jefe de equipo', gerente: 'Gerente' };
const UNI: Record<string, string> = { hora: '€ / hora', cepa: '€ / cepa', kg: '€ / kg' };
const eur = (n: number) => Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fd = (f: string) => new Date(f + 'T00:00').toLocaleDateString('es');

function Matriz({ clientes, servicios, tarifas, onSaved }: { clientes: any[]; servicios: any[]; tarifas: any[]; onSaved: () => void }) {
  const [cli, setCli] = useState(''); const [desde, setDesde] = useState(hoy()); const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Msg>(null); const [busy, setBusy] = useState(false);
  const UNIS = ['hora', 'cepa', 'kg'];
  const filas = [{ nombre: '*', etiqueta: 'Cualquier servicio (precio general del cliente)' }, ...servicios.map((x: any) => ({ nombre: x.nombre, etiqueta: x.nombre }))];
  const actual = (serv: string, uni: string) => tarifas.filter(t => (t.cliente_id || '') === cli && t.servicio === serv && t.unidad === uni && t.desde <= hoy()).sort((a: any, b: any) => b.desde.localeCompare(a.desde))[0];
  const num = (v: string) => Number(String(v).replace(',', '.'));
  const cambios = Object.entries(vals).filter(([k, v]) => { if (v.trim() === '') return false; const [serv, uni] = k.split('||'); const a = actual(serv, uni); return !(a && Number(a.precio) === num(v)); });
  async function guardar() {
    if (!cli) { setMsg({ t: 'err', m: 'Elige un cliente' }); return; }
    for (const [, v] of cambios) if (!(num(v) >= 0)) { setMsg({ t: 'err', m: 'Hay un precio no válido' }); return; }
    if (!confirm(`¿Guardar ${cambios.length} precio(s) para ${clientes.find(c => c.id === cli)?.nombre}, válidos desde ${desde}?`)) return;
    setBusy(true); setMsg(null); let ok = 0; const fallos: string[] = [];
    for (const [k, v] of cambios) {
      const [serv, uni] = k.split('||'); const precio = num(v);
      const { data, error } = await sb.from('tarifas').insert({ cliente_id: cli, servicio: serv, unidad: uni, precio, desde }).select('*').single();
      if (error) fallos.push(`${serv === '*' ? 'General' : serv} (${UNI[uni]}): ${error.message.includes('duplicate') ? 'ya hay un precio con esa fecha, usa otra fecha' : error.message}`);
      else if (!data || Number(data.precio) !== precio || data.unidad !== uni || data.servicio !== serv) fallos.push(`${serv} (${UNI[uni]}): el servidor devolvió otros valores`);
      else ok++;
    }
    setBusy(false); setVals({}); onSaved();
    setMsg(fallos.length ? { t: 'err', m: `${ok} guardado(s). Fallaron: ${fallos.join(' · ')}` } : { t: 'ok', m: `${ok} precio(s) guardados y verificados ✔` });
  }
  return (<div className="card"><h3>Precios negociados por cliente</h3>
    <div className="muted" style={{ marginBottom: 8 }}>Elige un cliente y escribe sus precios: €/hora, €/cepa o €/kg por servicio. Solo se guardan las casillas que cambies. Para un cliente puedes poner un precio general y después precios específicos de algún servicio (el específico manda). La facturación sigue en Artimove: esto sirve para calcular el margen.</div>
    {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
    <div className="row">
      <div className="field" style={{ maxWidth: 300 }}><label>Cliente</label><select value={cli} onChange={e => { setCli(e.target.value); setVals({}); setMsg(null); }}><option value="">— elige —</option>{clientes.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 170 }}><label>Precios válidos desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></div>
      <button className="btn btn-g btn-lg" disabled={busy || !cli || cambios.length === 0} onClick={guardar}>Guardar {cambios.length || ''} precio{cambios.length === 1 ? '' : 's'}</button>
    </div>
    {cli && <div style={{ overflowX: 'auto', marginTop: 10 }}><table><thead><tr><th>Servicio</th>{UNIS.map(u => <th key={u}>{UNI[u]}</th>)}</tr></thead>
      <tbody>{filas.map(f => (<tr key={f.nombre}><td>{f.etiqueta}</td>{UNIS.map(u => { const k = f.nombre + '||' + u; const a = actual(f.nombre, u); const v = vals[k]; const cambia = v !== undefined && v.trim() !== '' && !(a && Number(a.precio) === num(v));
        return <td key={u}><input type="number" step="0.0001" min="0" inputMode="decimal" style={{ width: 96, borderColor: cambia ? 'var(--gold)' : undefined, background: cambia ? 'var(--goldl)' : undefined }} placeholder={a ? String(a.precio) : '—'} value={v ?? ''} onChange={e => setVals({ ...vals, [k]: e.target.value })} /><div className="muted" style={{ fontSize: 10 }}>{a ? 'ahora ' + eur(a.precio) + ' €' : ''}</div></td>; })}</tr>))}</tbody></table>
      <div className="muted" style={{ marginTop: 6 }}>Las casillas en gris muestran el precio vigente hoy. Déjalas vacías si no cambian.</div></div>}
  </div>);
}

function Contenido() {
  const [coste, setCoste] = useState<any[]>([]); const [prima, setPrima] = useState<any[]>([]); const [tarifas, setTarifas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]); const [servicios, setServicios] = useState<any[]>([]); const [err, setErr] = useState('');
  const [c, setC] = useState({ tipo: 'peon', euros: '', desde: hoy() }); const [cm, setCm] = useState<Msg>(null);
  const [p, setP] = useState({ euros: '', desde: hoy() }); const [pm, setPm] = useState<Msg>(null);
  const [t, setT] = useState({ cliente_id: '', servicio: '*', unidad: 'hora', precio: '', desde: hoy() }); const [tm, setTm] = useState<Msg>(null);
  const [filtro, setFiltro] = useState('');
  const cargar = useCallback(async () => {
    try {
      const [a, b, d, e, f] = await Promise.all([
        sb.from('coste_hora').select('*').order('tipo_trabajador').order('desde', { ascending: false }),
        sb.from('prima_porteur').select('*').order('desde', { ascending: false }),
        todas((x, z) => sb.from('tarifas').select('*').order('desde', { ascending: false }).range(x, z)),
        todas((x, z) => sb.from('clientes').select('id,nombre').is('borrado_en', null).order('nombre').range(x, z)),
        sb.from('servicios').select('nombre,activo').is('borrado_en', null).order('nombre'),
      ]);
      if (a.error) throw a.error; if (b.error) throw b.error;
      setCoste(a.data || []); setPrima(b.data || []); setTarifas(d); setClientes(e); setServicios((f.data || []).filter((s: any) => s.activo));
    } catch (er: any) { setErr(er.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const nomCli = (id: string | null) => id ? clientes.find(x => x.id === id)?.nombre || '—' : 'Todos los clientes';

  async function guardar(tabla: string, fila: any, set: (m: Msg) => void, verif: (d: any) => boolean, ok: string) {
    set(null);
    const { data, error } = await sb.from(tabla).insert(fila).select('*').single();
    if (error) { set({ t: 'err', m: error.message.includes('duplicate') ? 'Ya existe un valor con esa fecha de inicio. Usa otra fecha.' : error.message }); return false; }
    if (!data || !verif(data)) { set({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return false; }
    set({ t: 'ok', m: ok }); cargar(); return true;
  }
  const num = (v: string) => Number(String(v).replace(',', '.'));
  const vigC = (tipo: string) => coste.filter(x => x.tipo_trabajador === tipo && x.desde <= hoy())[0];
  const tarVis = tarifas.filter(x => !filtro || (filtro === '_todos' ? x.cliente_id === null : x.cliente_id === filtro));

  return (<>
    <h2 style={{ marginBottom: 4 }}>Costes y tarifas</h2>
    <div className="muted" style={{ marginBottom: 12 }}>Solo administradores. Cada cambio se guarda como una versión nueva con su fecha de inicio: el histórico no se pierde y los cálculos pasados siguen usando el valor que tocaba en su día.</div>
    {err && <div className="msg err">{err}</div>}

    <div className="card"><h3>Coste por hora del trabajador (para la empresa)</h3>
      <div className="muted" style={{ marginBottom: 8 }}>Incluye lo que te cuesta cada hora (salario + cargas). Cámbialo cuando suba la patronal u otro coste. En el ERP anterior usabas 15,00 €/h para todos.</div>
      {cm && <div className={'msg ' + cm.t}>{cm.m}</div>}
      <div className="row" style={{ marginBottom: 10 }}>
        {Object.keys(TIPO).map(k => <div key={k} className="kpi" style={{ minWidth: 150 }}><div className="kn" style={{ fontSize: 20 }}>{vigC(k) ? eur(vigC(k).euros_hora) + ' €' : 'sin definir'}</div><div className="kl">{TIPO[k]} · vigente hoy</div></div>)}</div>
      <div className="row">
        <div className="field" style={{ maxWidth: 170 }}><label>Tipo</label><select value={c.tipo} onChange={e => setC({ ...c, tipo: e.target.value })}>{Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 130 }}><label>€ por hora</label><input type="number" step="0.01" min="0" value={c.euros} onChange={e => setC({ ...c, euros: e.target.value })} /></div>
        <div className="field" style={{ maxWidth: 170 }}><label>Vale desde</label><input type="date" value={c.desde} onChange={e => setC({ ...c, desde: e.target.value })} /></div>
        <button className="btn btn-g" onClick={() => { const v = num(c.euros); if (!(v >= 0) || c.euros === '') { setCm({ t: 'err', m: 'Indica el importe' }); return; } guardar('coste_hora', { tipo_trabajador: c.tipo, euros_hora: v, desde: c.desde }, setCm, d => Number(d.euros_hora) === v && d.desde === c.desde, 'Coste guardado ✔'); }}>Añadir versión</button></div>
      {coste.length > 0 && <table style={{ marginTop: 10 }}><thead><tr><th>Tipo</th><th>€/hora</th><th>Desde</th></tr></thead><tbody>{coste.map(x => <tr key={x.id}><td>{TIPO[x.tipo_trabajador]}</td><td>{eur(x.euros_hora)}</td><td>{fd(x.desde)}</td></tr>)}</tbody></table>}
    </div>

    <div className="card"><h3>Prima diaria del porteur</h3>
      {pm && <div className={'msg ' + pm.t}>{pm.m}</div>}
      <div className="muted" style={{ marginBottom: 8 }}>Se suma al coste por cada día que un trabajador figura como P en la vendimia. Vigente hoy: <b>{prima.filter(x => x.desde <= hoy())[0] ? eur(prima.filter(x => x.desde <= hoy())[0].euros_dia) + ' €/día' : 'sin definir'}</b></div>
      <div className="row">
        <div className="field" style={{ maxWidth: 130 }}><label>€ por día</label><input type="number" step="0.01" min="0" value={p.euros} onChange={e => setP({ ...p, euros: e.target.value })} /></div>
        <div className="field" style={{ maxWidth: 170 }}><label>Vale desde</label><input type="date" value={p.desde} onChange={e => setP({ ...p, desde: e.target.value })} /></div>
        <button className="btn btn-g" onClick={() => { const v = num(p.euros); if (p.euros === '' || !(v >= 0)) { setPm({ t: 'err', m: 'Indica el importe' }); return; } guardar('prima_porteur', { euros_dia: v, desde: p.desde }, setPm, d => Number(d.euros_dia) === v && d.desde === p.desde, 'Prima guardada ✔'); }}>Añadir versión</button></div>
      {prima.length > 0 && <table style={{ marginTop: 10 }}><thead><tr><th>€/día</th><th>Desde</th></tr></thead><tbody>{prima.map(x => <tr key={x.id}><td>{eur(x.euros_dia)}</td><td>{fd(x.desde)}</td></tr>)}</tbody></table>}
    </div>

    <Matriz clientes={clientes} servicios={servicios} tarifas={tarifas} onSaved={cargar} />

    <div className="card"><h3>Tarifas de venta · historial y alta individual</h3>
      <div className="muted" style={{ marginBottom: 8 }}>Para calcular el margen. La facturación sigue haciéndose en Artimove. Se usa la tarifa más específica: cliente + servicio, luego cliente (cualquier servicio), luego servicio general y por último la general.</div>
      {tm && <div className={'msg ' + tm.t}>{tm.m}</div>}
      <div className="row">
        <div className="field"><label>Cliente</label><select value={t.cliente_id} onChange={e => setT({ ...t, cliente_id: e.target.value })}><option value="">Todos los clientes</option>{clientes.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
        <div className="field"><label>Servicio</label><select value={t.servicio} onChange={e => setT({ ...t, servicio: e.target.value })}><option value="*">Cualquier servicio</option>{servicios.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 130 }}><label>Unidad</label><select value={t.unidad} onChange={e => setT({ ...t, unidad: e.target.value })}>{Object.entries(UNI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 120 }}><label>Precio</label><input type="number" step="0.0001" min="0" value={t.precio} onChange={e => setT({ ...t, precio: e.target.value })} /></div>
        <div className="field" style={{ maxWidth: 160 }}><label>Vale desde</label><input type="date" value={t.desde} onChange={e => setT({ ...t, desde: e.target.value })} /></div>
        <button className="btn btn-g" onClick={() => { const v = num(t.precio); if (t.precio === '' || !(v >= 0)) { setTm({ t: 'err', m: 'Indica el precio' }); return; } guardar('tarifas', { cliente_id: t.cliente_id || null, servicio: t.servicio, unidad: t.unidad, precio: v, desde: t.desde }, setTm, d => Number(d.precio) === v && d.unidad === t.unidad && d.servicio === t.servicio, 'Tarifa guardada ✔'); }}>Añadir tarifa</button></div>
      <div className="field" style={{ maxWidth: 260, marginTop: 12 }}><label>Ver tarifas de</label><select value={filtro} onChange={e => setFiltro(e.target.value)}><option value="">Todos</option><option value="_todos">Tarifas generales</option>{clientes.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
      {tarVis.length === 0 ? <div className="muted" style={{ marginTop: 8 }}>Aún no hay tarifas.</div> :
        <table style={{ marginTop: 8 }}><thead><tr><th>Cliente</th><th>Servicio</th><th>Unidad</th><th>Precio</th><th>Desde</th></tr></thead><tbody>{tarVis.map(x => <tr key={x.id}><td>{nomCli(x.cliente_id)}</td><td>{x.servicio === '*' ? 'Cualquiera' : x.servicio}</td><td>{UNI[x.unidad]}</td><td>{eur(x.precio)}</td><td>{fd(x.desde)}</td></tr>)}</tbody></table>}
    </div>
  </>);
}
export default function Page() { return <Shell roles={['admin']}>{() => <Contenido />}</Shell>; }
