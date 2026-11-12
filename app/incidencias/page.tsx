'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas, Perfil } from '@/lib/supabase';
const TIPOS: Record<string, string> = { accidente: 'Accidente', retraso: 'Retraso', material: 'Falta de material', clima: 'Clima', cliente: 'Cliente', otra: 'Otra' };

function Contenido({ perfil }: { perfil: Perfil }) {
  const admin = perfil.rol === 'admin';
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [soloAbiertas, setSolo] = useState(true); const [msg, setMsg] = useState('');
  const cargar = useCallback(async () => {
    try { setRows(await todas((a, b) => sb.from('incidencias').select('id,tipo,descripcion,estado,nota_resolucion,creado_en,trabajadores(nombre),jornadas(fecha,perfiles:jefe_id(nombre),tareas(nombre,clientes(nombre)))').is('borrado_en', null).order('creado_en', { ascending: false }).range(a, b))); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  async function resolver(i: any) {
    const nota = prompt('Nota de resolución (opcional):') ; if (nota === null) return;
    const { error } = await sb.from('incidencias').update({ estado: 'resuelta', nota_resolucion: nota || null }).eq('id', i.id);
    if (error) { setMsg(error.message); return; }
    const { data } = await sb.from('incidencias').select('estado').eq('id', i.id).single();
    if (data?.estado !== 'resuelta') { setMsg('El servidor no confirmó el cambio.'); return; }
    setMsg(''); cargar();
  }
  const vis = (rows || []).filter(r => !soloAbiertas || r.estado === 'abierta');
  return (<>
    <h2 style={{ marginBottom: 10 }}>Incidencias</h2>
    <div className="card"><label style={{ margin: 0 }}><input type="checkbox" checked={soloAbiertas} onChange={e => setSolo(e.target.checked)} /> Solo abiertas</label></div>
    {msg && <div className="msg err">{msg}</div>}{err && <div className="msg err">{err}</div>}
    {!rows && !err && <div className="muted">Cargando…</div>}
    {rows && vis.length === 0 && <div className="card muted">No hay incidencias{soloAbiertas ? ' abiertas' : ''}.</div>}
    {vis.map(i => <div key={i.id} className={'inc' + (i.estado === 'resuelta' ? ' res' : '')} style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><b>{TIPOS[i.tipo]}</b> · {i.jornadas?.fecha} · {i.jornadas?.tareas?.clientes?.nombre} — {i.jornadas?.tareas?.nombre}
          <div className="muted">Jefe: {i.jornadas?.perfiles?.nombre || '—'}{i.trabajadores?.nombre ? ' · Trabajador: ' + i.trabajadores.nombre : ''}</div></div>
        {i.estado === 'abierta' ? (admin && <button className="btn btn-g" onClick={() => resolver(i)}>Marcar resuelta</button>) : <span className="badge b-va">resuelta</span>}</div>
      <div style={{ marginTop: 6 }}>{i.descripcion}</div>{i.nota_resolucion && <div className="muted" style={{ marginTop: 4 }}>Resolución: {i.nota_resolucion}</div>}
    </div>)}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido perfil={p} />}</Shell>; }
