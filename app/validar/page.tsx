'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { sb } from '@/lib/supabase';

function Contenido() {
  const [js, setJs] = useState<any[] | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [portal, setPortal] = useState(false);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await sb.from('jornadas')
      .select('id,fecha,jefe_id,tareas(nombre,clientes(nombre)),jornada_trabajador(horas_normal,horas_extra,ausente,funcion,borrado_en,trabajadores(nombre)),jornada_cantidad(unidad,cantidad,borrado_en)')
      .eq('estado', 'fichada').is('borrado_en', null).order('fecha');
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    setJs(data || []); setSel({});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const ids = Object.keys(sel).filter(k => sel[k]);
  async function validar() {
    if (!ids.length) return;
    if (!confirm(`¿Validar ${ids.length} jornada(s)${portal ? ' y aprobarlas para el portal del cliente' : ''}?`)) return;
    setBusy(true); setMsg(null);
    const patch: any = { estado: 'validada' }; if (portal) patch.aprobada_portal = true;
    const { data, error } = await sb.from('jornadas').update(patch).in('id', ids).select('id,estado');
    setBusy(false);
    if (error || (data || []).length !== ids.length || (data || []).some((d: any) => d.estado !== 'validada')) {
      setMsg({ t: 'err', m: 'No se validaron todas: ' + (error?.message || `${data?.length ?? 0} de ${ids.length}`) });
    } else setMsg({ t: 'ok', m: `${ids.length} jornada(s) validadas y verificadas ✔` });
    cargar();
  }
  const horas = (j: any) => (j.jornada_trabajador || []).filter((l: any) => !l.borrado_en && !l.ausente).reduce((s: number, l: any) => s + Number(l.horas_normal) + Number(l.horas_extra), 0);
  return (<>
    <h2 style={{ marginBottom: 10 }}>Jornadas pendientes de validar</h2>
    {msg && <div className={'msg ' + msg.t}>{msg.m}</div>}
    <div className="card row">
      <button className="btn" onClick={() => setSel(Object.fromEntries((js || []).map(j => [j.id, true])))}>Seleccionar todas</button>
      <button className="btn" onClick={() => setSel({})}>Ninguna</button>
      <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={portal} onChange={e => setPortal(e.target.checked)} /> Aprobar también para el portal del cliente</label>
      <button className="btn btn-g" disabled={busy || !ids.length} onClick={validar}>Validar {ids.length || ''}</button>
    </div>
    {js === null && <div className="muted">Cargando…</div>}
    {js?.length === 0 && <div className="card muted">No hay jornadas pendientes. Todo está validado.</div>}
    {js?.map(j => (<div className="card" key={j.id}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'inherit' }}>
          <input type="checkbox" checked={!!sel[j.id]} onChange={e => setSel(s => ({ ...s, [j.id]: e.target.checked }))} />
          <b>{j.fecha}</b> · {j.tareas?.clientes?.nombre} — {j.tareas?.nombre}
        </label>
        <span className="muted">{(j.jornada_trabajador || []).filter((l: any) => !l.borrado_en && !l.ausente).length} personas · <b>{horas(j)} h</b>{j.jornada_cantidad?.[0] ? ` · ${j.jornada_cantidad[0].cantidad} ${j.jornada_cantidad[0].unidad}` : ''}</span>
      </div>
      <table style={{ marginTop: 6 }}><tbody>{(j.jornada_trabajador || []).filter((l: any) => !l.borrado_en).map((l: any, i: number) => (
        <tr key={i}><td>{l.trabajadores?.nombre} {l.funcion === 'porteur' && <span className="badge" style={{ background: 'var(--pl)', color: 'var(--p)' }}>P</span>}</td>
          <td>{l.ausente ? 'Ausente' : `${l.horas_normal} h + ${l.horas_extra} extra`}</td></tr>))}</tbody></table>
    </div>))}
  </>);
}
export default function Validar() { return <Shell roles={['admin']}>{() => <Contenido />}</Shell>; }
