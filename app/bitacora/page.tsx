'use client';
import { useEffect, useState, useMemo } from 'react';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, hoy, todas } from '@/lib/supabase';

const f2 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 });
const EST: Record<string, string> = { planificada: 'b-pl', fichada: 'b-fi', validada: 'b-va' };
const csvCell = (v: any) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function Contenido() {
  const [desde, setDesde] = useState('2026-11-09'); const [hasta, setHasta] = useState(hoy());
  const [cliente, setCliente] = useState(''); const [q, setQ] = useState(''); const [estado, setEstado] = useState('');
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    setRows(null); setErr('');
    try {
      setRows(await todas((a, b) => sb.from('jornadas').select('id,fecha,estado,observaciones,perfiles:jefe_id(nombre),tareas(nombre,modalidad,clientes(id,nombre)),jornada_trabajador(horas_normal,horas_extra,ausente,confirmado,borrado_en),jornada_cantidad(unidad,cantidad,borrado_en),incidencias(id,borrado_en)')
        .is('borrado_en', null).gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('id').range(a, b)));
    } catch (e: any) { setErr(e.message); }
  })(); }, [desde, hasta]);
  const filas = useMemo(() => (rows || []).map(j => {
    const ls = (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en);
    const pres = ls.filter((l: any) => l.confirmado && !l.ausente);
    const cant = (j.jornada_cantidad || []).filter((c: any) => !c.borrado_en)[0];
    return { id: j.id, fecha: j.fecha, estado: j.estado, cliente: j.tareas?.clientes?.nombre || '—', cid: j.tareas?.clientes?.id, servicio: j.tareas?.nombre || '—', modalidad: j.tareas?.modalidad, jefe: j.perfiles?.nombre || '',
      personas: pres.length, ausentes: ls.filter((l: any) => l.confirmado && l.ausente).length, sinConf: ls.filter((l: any) => !l.confirmado).length,
      horas: pres.reduce((s: number, l: any) => s + Number(l.horas_normal) + Number(l.horas_extra), 0), cantidad: cant ? Number(cant.cantidad) : null, unidad: cant?.unidad || '', obs: j.observaciones || '',
      inc: (j.incidencias || []).filter((i: any) => !i.borrado_en).length };
  }).filter(f => (!cliente || f.cid === cliente) && (!estado || f.estado === estado) && (!q || (f.obs + ' ' + f.servicio + ' ' + f.cliente + ' ' + f.jefe).toLowerCase().includes(q.toLowerCase()))), [rows, cliente, q, estado]);
  const clientes = useMemo(() => { const m = new Map<string, string>(); (rows || []).forEach(j => { const c = j.tareas?.clientes; if (c) m.set(c.id, c.nombre); }); return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])); }, [rows]);
  const tot = filas.reduce((s, f) => ({ h: s.h + f.horas, j: s.j + 1 }), { h: 0, j: 0 });
  function csv() {
    const cab = ['Fecha', 'Cliente', 'Servicio', 'Modalidad', 'Jefe', 'Personas', 'Ausentes', 'Horas', 'Cantidad', 'Unidad', 'Incidencias', 'Estado', 'Observaciones'];
    const lineas = [cab, ...filas.map(f => [f.fecha, f.cliente, f.servicio, f.modalidad, f.jefe, f.personas, f.ausentes, f.horas, f.cantidad ?? '', f.unidad, f.inc, f.estado, f.obs])];
    const blob = new Blob(['﻿' + lineas.map(l => l.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bitacora_${desde}_${hasta}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  return (<>
    <h2 style={{ marginBottom: 10 }}>Bitácora</h2>
    <div className="card row">
      <div className="field" style={{ maxWidth: 160 }}><label>Desde</label><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 160 }}><label>Hasta</label><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></div>
      <div className="field"><label>Cliente</label><select value={cliente} onChange={e => setCliente(e.target.value)}><option value="">Todos</option>{clientes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 150 }}><label>Estado</label><select value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos</option><option value="planificada">Planificada</option><option value="fichada">Fichada</option><option value="validada">Validada</option></select></div>
      <div className="field"><label>Buscar</label><input placeholder="servicio, jefe, observación…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <button className="btn" disabled={!filas.length} onClick={csv}>Descargar CSV</button>
    </div>
    {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
    {rows && <div className="card" style={{ overflowX: 'auto' }}>
      <div className="muted" style={{ marginBottom: 8 }}>{tot.j} jornadas · {f2(tot.h)} h</div>
      {filas.length === 0 ? <div className="muted">No hay jornadas con esos filtros.</div> :
        <table><thead><tr><th>Fecha</th><th>Cliente · servicio</th><th>Jefe</th><th>Pers.</th><th>Horas</th><th>Cantidad</th><th>Observaciones</th><th>Estado</th></tr></thead><tbody>
          {filas.map(f => <tr key={f.id}>
            <td style={{ whiteSpace: 'nowrap' }}>{new Date(f.fecha + 'T00:00').toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' })}</td>
            <td>{f.cliente}<div className="muted">{f.servicio}{f.modalidad && f.modalidad !== 'hora' ? ` · por ${f.modalidad}` : ''}</div></td>
            <td>{f.jefe}</td>
            <td>{f.personas}{f.ausentes > 0 && <div className="muted">{f.ausentes} aus.</div>}{f.sinConf > 0 && <div className="muted">{f.sinConf} sin conf.</div>}</td>
            <td>{f2(f.horas)}</td>
            <td>{f.cantidad !== null ? f2(f.cantidad) + ' ' + f.unidad : '—'}</td>
            <td style={{ maxWidth: 260 }}>{f.obs}{f.inc > 0 && <div><span className="badge b-fi">⚠ {f.inc} incidencia{f.inc > 1 ? 's' : ''}</span></div>}</td>
            <td><span className={'badge ' + EST[f.estado]}>{f.estado}</span></td></tr>)}
        </tbody></table>}
    </div>}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
