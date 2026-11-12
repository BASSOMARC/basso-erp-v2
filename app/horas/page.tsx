'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas, Perfil } from '@/lib/supabase';
import { Fragment } from 'react';

const mes = (y: number, m: number) => [`${y}-${String(m).padStart(2, '0')}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];

function Fila({ r, admin, onSaved }: any) {
  const [h, setH] = useState(String(r.horas_normal)); const [he, setHe] = useState(String(r.horas_extra));
  const [aus, setAus] = useState(r.ausente); const [fn, setFn] = useState<string | null>(r.funcion);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cambiado = Number(h) !== Number(r.horas_normal) || Number(he) !== Number(r.horas_extra) || aus !== r.ausente || (fn || null) !== (r.funcion || null);
  async function guardar() {
    const nuevo = { horas_normal: aus ? 0 : Number(h || 0), horas_extra: aus ? 0 : Number(he || 0), ausente: aus, funcion: aus ? null : fn };
    if (!confirm(`${r.trabajadores?.nombre}, ${r.jornadas?.fecha}:\nantes ${r.horas_normal} h + ${r.horas_extra} extra${r.ausente ? ' (ausente)' : ''}\nahora ${nuevo.horas_normal} h + ${nuevo.horas_extra} extra${nuevo.ausente ? ' (ausente)' : ''}\n\n¿Guardar la corrección?`)) return;
    setMsg(null);
    const { error } = await sb.from('jornada_trabajador').update(nuevo).eq('id', r.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    const { data } = await sb.from('jornada_trabajador').select('horas_normal,horas_extra,ausente,funcion').eq('id', r.id).single();
    if (!data || Number(data.horas_normal) !== nuevo.horas_normal || Number(data.horas_extra) !== nuevo.horas_extra || data.ausente !== nuevo.ausente || (data.funcion || null) !== (nuevo.funcion || null)) {
      setMsg({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return;
    }
    setMsg({ t: 'ok', m: 'Corregido y verificado ✔' }); onSaved();
  }
  return (<tr>
    <td>{r.jornadas?.fecha}</td><td>{r.jornadas?.tareas?.clientes?.nombre}<div className="muted">{r.jornadas?.tareas?.nombre}</div></td><td>{r.trabajadores?.nombre}</td>
    <td><input type="number" step="0.25" min="0" max="24" disabled={!admin || aus} value={h} onChange={e => setH(e.target.value)} /></td>
    <td><input type="number" step="0.25" min="0" max="24" disabled={!admin || aus} value={he} onChange={e => setHe(e.target.value)} /></td>
    <td><input type="checkbox" disabled={!admin} checked={aus} onChange={e => setAus(e.target.checked)} /></td>
    <td><button disabled={!admin || aus} className={'btn btn-p' + (fn === 'porteur' ? ' on' : '')} onClick={() => setFn(fn === 'porteur' ? 'coupeur' : 'porteur')}>{fn === 'porteur' ? 'P' : fn === 'coupeur' ? 'C' : '—'}</button></td>
    <td>{admin && <button className="btn btn-g" disabled={!cambiado} onClick={guardar}>Guardar</button>}{msg && <div className={'msg ' + msg.t} style={{ marginTop: 4 }}>{msg.m}</div>}</td>
  </tr>);
}


const pad = (n: number) => String(n).padStart(2, '0');
const iso = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
const D = (f: string) => new Date(f + 'T00:00:00Z');
const lunes = (f: string) => { const d = D(f); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return iso(d); };
const suma = (f: string, n: number) => { const d = D(f); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const f1 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('es', { maximumFractionDigits: 2 });
const eur = (n: number) => n.toLocaleString('es', { style: 'currency', currency: 'EUR' });
const LJ = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const SEM = 35;
const vig = (arr: any[], fecha: string) => arr.filter(x => x.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde))[0];

function Hoja({ y, m, admin, trab, setTrab }: { y: number; m: number; admin: boolean; trab: string; setTrab: (s: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const [cost, setCost] = useState<{ coste: any[]; prima: any[] }>({ coste: [], prima: [] });
  const [a, b] = mes(y, m); const ultimo = suma(b, -1); const ini = lunes(a); const fin = suma(lunes(ultimo), 7);
  useEffect(() => { (async () => {
    setRows(null); setErr('');
    try {
      const data = await todas((x, z) => sb.from('jornada_trabajador')
        .select('horas_normal,horas_extra,ausente,funcion,trabajador_id,trabajadores(nombre,tipo,estado),jornadas!inner(fecha)')
        .is('borrado_en', null).eq('confirmado', true).gte('jornadas.fecha', ini).lt('jornadas.fecha', fin).order('id').range(x, z));
      setRows(data);
      if (admin) { const [c, p] = await Promise.all([sb.from('coste_hora').select('*'), sb.from('prima_porteur').select('*')]); setCost({ coste: c.data || [], prima: p.data || [] }); }
    } catch (e: any) { setErr(e.message); }
  })(); }, [y, m]);

  const nd = Number(ultimo.slice(8)); const dias = Array.from({ length: nd }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
  const res = useMemo(() => {
    if (!rows) return [];
    const T: Record<string, any> = {};
    rows.forEach(r => {
      const id = r.trabajador_id; const f = r.jornadas.fecha;
      const t = (T[id] ||= { id, nombre: r.trabajadores?.nombre || '—', tipo: r.trabajadores?.tipo || 'peon', dia: {} as Record<string, any> });
      const d = (t.dia[f] ||= { h: 0, aus: false, hay: false, P: false, coste: 0 });
      d.hay = true;
      if (r.ausente) d.aus = true; else {
        const h = Number(r.horas_normal) + Number(r.horas_extra); d.h += h;
        if (r.funcion === 'porteur') d.P = true;
        const ch = vig(cost.coste.filter((x: any) => x.tipo_trabajador === t.tipo), f); d.coste += h * Number(ch?.euros_hora || 0);
        if (r.funcion === 'porteur') d.coste += Number(vig(cost.prima, f)?.euros_dia || 0);
      }
    });
    return Object.values(T).map((t: any) => {
      let horas = 0, trabajados = 0, ausentes = 0, coste = 0, normales = 0, extra = 0;
      dias.forEach(f => { const d = t.dia[f]; if (!d) return; if (d.h > 0) { horas += d.h; trabajados++; coste += d.coste; } else if (d.aus) ausentes++; });
      const sem: any[] = [];
      for (let w = ini; w < fin; w = suma(w, 7)) {
        let h = 0, dt = 0; for (let k = 0; k < 7; k++) { const d = t.dia[suma(w, k)]; if (d && d.h > 0) { h += d.h; dt++; } }
        if (h === 0 && dt === 0) continue;
        const dom = suma(w, 6); const mesDom = dom >= a && dom < b;
        const e = Math.max(0, h - SEM); sem.push({ w, dom, h, dt, n: Math.min(h, SEM), e, cuenta: mesDom });
        if (mesDom) { normales += Math.min(h, SEM); extra += e; }
      }
      return { ...t, horas, trabajados, ausentes, coste, normales, extra, sem };
    }).sort((p: any, q: any) => p.nombre.localeCompare(q.nombre));
  }, [rows, cost, y, m]);

  const lista = trab ? res.filter((r: any) => r.id === trab) : res;
  const tot = lista.reduce((s: any, r: any) => ({ h: s.h + r.horas, c: s.c + r.coste, e: s.e + r.extra }), { h: 0, c: 0, e: 0 });
  function csv() {
    const L = [['Trabajador', 'Dias trabajados', 'Dias ausentes', 'Horas totales (dias del mes)', 'Horas normales (semanas que acaban en el mes)', 'Horas extra (semanas que acaban en el mes)', ...(admin ? ['Coste EUR'] : [])]];
    lista.forEach((r: any) => L.push([r.nombre, r.trabajados, r.ausentes, r.horas, r.normales, r.extra, ...(admin ? [Math.round(r.coste * 100) / 100] : [])].map(String)));
    const t = '﻿' + L.map(l => l.map(c => '"' + String(c).replace(/"/g, '""').replace(/\./g, ',') + '"').join(';')).join('\n');
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })); el.download = `horas-${y}-${pad(m)}.csv`; el.click();
  }
  const sel = trab ? res.find((r: any) => r.id === trab) : null;
  return (<>
    {err && <div className="msg err">{err}</div>}
    {rows === null && !err && <div className="muted">Cargando…</div>}
    {rows && <>
      <div className="kpis">
        <div className="kpi"><div className="kn">{f1(tot.h)} h</div><div className="kl">Horas del mes{trab ? ' (trabajador)' : ''}</div></div>
        <div className="kpi"><div className="kn">{f1(tot.e)} h</div><div className="kl">Extra (sobre {SEM} h/semana)</div></div>
        {admin && <div className="kpi"><div className="kn">{eur(tot.c)}</div><div className="kl">Coste mano de obra</div></div>}
        <div className="kpi"><button className="btn" onClick={csv}>Descargar para nóminas (CSV)</button></div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ whiteSpace: 'nowrap' }}>
          <thead><tr><th style={{ position: 'sticky', left: 0, background: 'var(--bg)' }}>Trabajador</th>
            {dias.map(f => { const w = D(f).getUTCDay(); return <th key={f} style={{ textAlign: 'center', padding: '4px 3px', background: w === 0 || w === 6 ? 'var(--pl)' : undefined }}><div className="muted" style={{ fontSize: 10 }}>{LJ[w]}</div>{Number(f.slice(8))}</th>; })}
            <th>Total h</th><th>Días trab.</th><th>Ausentes</th><th>Extra h</th>{admin && <th>Coste</th>}</tr></thead>
          <tbody>
            {lista.map((r: any) => (<tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setTrab(trab === r.id ? '' : r.id)}>
              <td style={{ position: 'sticky', left: 0, background: 'var(--bg)' }}><b>{r.nombre}</b></td>
              {dias.map(f => { const d = r.dia[f]; const w = D(f).getUTCDay();
                return <td key={f} style={{ textAlign: 'center', padding: '4px 3px', background: w === 0 || w === 6 ? 'var(--pl)' : undefined, color: d && d.h === 0 && d.aus ? 'var(--r)' : 'inherit' }}>
                  {d ? (d.h > 0 ? <>{f1(d.h)}{d.P && <sup>P</sup>}</> : d.aus ? 'A' : '') : ''}</td>; })}
              <td><b>{f1(r.horas)}</b></td><td>{r.trabajados}</td><td>{r.ausentes}</td><td>{f1(r.extra)}</td>{admin && <td>{eur(r.coste)}</td>}
            </tr>))}
            {lista.length === 0 && <tr><td colSpan={nd + 6} className="muted">Sin horas este mes.</td></tr>}
          </tbody>
        </table>
        <div className="muted" style={{ marginTop: 6 }}>A = ausente · P = porteur · fines de semana en color. Pulsa una fila para ver solo a ese trabajador.</div>
      </div>
      {sel && <div className="card">
        <h3 style={{ marginBottom: 6 }}>{sel.nombre} · desglose semanal</h3>
        <table><thead><tr><th>Semana (lun–dom)</th><th>Días</th><th>Horas</th><th>Normales (hasta {SEM})</th><th>Extra</th><th></th></tr></thead>
          <tbody>{sel.sem.map((s: any) => <tr key={s.w}><td>{s.w.slice(5)} → {s.dom.slice(5)}</td><td>{s.dt}</td><td>{f1(s.h)}</td><td>{f1(s.n)}</td><td style={{ color: s.e > 0 ? 'var(--r)' : 'inherit' }}>{f1(s.e)}</td><td className="muted">{s.cuenta ? '' : 'cuenta en el mes siguiente'}</td></tr>)}</tbody></table>
        <div className="muted" style={{ marginTop: 6 }}>Total mes: {f1(sel.horas)} h · {sel.trabajados} días trabajados · {sel.ausentes} días ausentes · normales {f1(sel.normales)} h · extra {f1(sel.extra)} h</div>
      </div>}
      <div className="muted">Las horas extra se calculan por semana natural (lunes a domingo): lo que pasa de {SEM} h es extra. Cuando una semana cruza dos meses, sus normales y extra se cuentan en el mes en que acaba la semana (domingo); confírmalo con quien haga las nóminas. «Horas del mes» suma los días del mes tal cual.</div>
    </>}
  </>);
}

function Detalle({ y, m, admin, trab }: { y: number; m: number; admin: boolean; trab: string }) {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    setRows(null); setErr('');
    const [a, b] = mes(y, m);
    let data: any[]; try { data = await todas((x, z) => sb.from('jornada_trabajador')
      .select('id,trabajador_id,horas_normal,horas_extra,ausente,funcion,trabajadores(nombre),jornadas!inner(fecha,estado,tareas(nombre,clientes(nombre)))')
      .is('borrado_en', null).eq('confirmado', true).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)); } catch (e: any) { setErr(e.message); return; }
    setRows((data || []).sort((p: any, q: any) => (q.jornadas.fecha + q.trabajadores?.nombre).localeCompare(p.jornadas.fecha + p.trabajadores?.nombre)));
  }, [y, m]);
  useEffect(() => { cargar(); }, [cargar]);
  const ver = (rows || []).filter(r => !trab || r.trabajador_id === trab);
  return (<>
    {!admin && <div className="msg ok">Solo lectura: las correcciones las hace un administrador.</div>}
    {err && <div className="msg err">{err}</div>}
    {rows === null && !err && <div className="muted">Cargando…</div>}
    <div className="card" style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>Fecha</th><th>Cliente / tarea</th><th>Trabajador</th><th>Horas</th><th>Extra</th><th>Aus.</th><th>C/P</th><th></th></tr></thead>
        <tbody>{ver.map(r => <Fila key={r.id} r={r} admin={admin} onSaved={cargar} />)}</tbody></table>
      {rows && ver.length === 0 && <div className="muted">Sin horas este mes.</div>}
    </div>
  </>);
}

function Contenido({ perfil }: { perfil: Perfil }) {
  const d = new Date();
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1);
  const [vista, setVista] = useState<'hoja' | 'detalle'>('hoja'); const [trab, setTrab] = useState('');
  const [lt, setLt] = useState<any[]>([]);
  useEffect(() => { (async () => { const r = await todas((x, z) => sb.from('trabajadores').select('id,nombre').is('borrado_en', null).order('nombre').range(x, z)); setLt(r); })().catch(() => {}); }, []);
  const admin = perfil.rol === 'admin';
  const mover = (n: number) => { let mm = m + n, yy = y; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } setM(mm); setY(yy); };
  return (<>
    <h2 style={{ marginBottom: 10 }}>Control de horas</h2>
    <div className="card row">
      <button className="btn" onClick={() => mover(-1)}>◀</button>
      <div className="field" style={{ maxWidth: 140 }}><label>Mes</label><select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('es', { month: 'long' })}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 100 }}><label>Año</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} /></div>
      <button className="btn" onClick={() => mover(1)}>▶</button>
      <div className="field" style={{ maxWidth: 220 }}><label>Trabajador</label><select value={trab} onChange={e => setTrab(e.target.value)}><option value="">Todos</option>{lt.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
      <button className={'btn' + (vista === 'hoja' ? ' btn-g' : '')} onClick={() => setVista('hoja')}>Hoja mensual</button>
      <button className={'btn' + (vista === 'detalle' ? ' btn-g' : '')} onClick={() => setVista('detalle')}>Detalle y correcciones</button>
    </div>
    {vista === 'hoja' ? <Hoja key={y + '-' + m} y={y} m={m} admin={admin} trab={trab} setTrab={setTrab} /> : <Detalle key={y + '-' + m} y={y} m={m} admin={admin} trab={trab} />}
  </>);
}
export default function Horas() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido perfil={p} />}</Shell>; }
