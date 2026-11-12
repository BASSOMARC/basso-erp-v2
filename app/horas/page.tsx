'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas, Perfil } from '@/lib/supabase';

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

function Contenido({ perfil }: { perfil: Perfil }) {
  const d = new Date();
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1);
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const cargar = useCallback(async () => {
    setRows(null); setErr('');
    const [a, b] = mes(y, m);
    let data: any[]; try { data = await todas((x, z) => sb.from('jornada_trabajador')
      .select('id,horas_normal,horas_extra,ausente,funcion,trabajadores(nombre),jornadas!inner(fecha,estado,tareas(nombre,clientes(nombre)))')
      .is('borrado_en', null).eq('confirmado', true).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)); } catch (e: any) { setErr(e.message); return; }
    setRows((data || []).sort((p: any, q: any) => (q.jornadas.fecha + q.trabajadores?.nombre).localeCompare(p.jornadas.fecha + p.trabajadores?.nombre)));
  }, [y, m]);
  useEffect(() => { cargar(); }, [cargar]);
  const admin = perfil.rol === 'admin';
  const tot = (rows || []).reduce((s, r) => s + (r.ausente ? 0 : Number(r.horas_normal) + Number(r.horas_extra)), 0);
  const porteurs = (rows || []).filter(r => r.funcion === 'porteur' && !r.ausente).length;
  return (<>
    <h2 style={{ marginBottom: 10 }}>Control de horas</h2>
    <div className="card row">
      <div className="field" style={{ maxWidth: 130 }}><label>Mes</label><select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString('es', { month: 'long' })}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 110 }}><label>Año</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} /></div>
      <div className="muted">{rows ? <>Total: <b>{tot} h</b> · días de porteur (P): <b>{porteurs}</b></> : ''}</div>
    </div>
    {!admin && <div className="msg ok">Solo lectura: las correcciones las hace un administrador.</div>}
    {err && <div className="msg err">{err}</div>}
    {rows === null && !err && <div className="muted">Cargando…</div>}
    <div className="card" style={{ overflowX: 'auto' }}>
      <table><thead><tr><th>Fecha</th><th>Cliente / tarea</th><th>Trabajador</th><th>Horas</th><th>Extra</th><th>Aus.</th><th>C/P</th><th></th></tr></thead>
        <tbody>{rows?.map(r => <Fila key={r.id} r={r} admin={admin} onSaved={cargar} />)}</tbody></table>
      {rows?.length === 0 && <div className="muted">Sin horas este mes.</div>}
    </div>
  </>);
}
export default function Horas() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido perfil={p} />}</Shell>; }
