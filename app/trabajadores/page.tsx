'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, todas, Perfil } from '@/lib/supabase';
const f2 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 });

function Fila({ w, admin, onSaved }: any) {
  const [n, setN] = useState(w.nombre); const [t, setT] = useState(w.tipo); const [e, setE] = useState(w.estado); const [fi, setFi] = useState(w.fecha_inicio || ''); const [fh, setFh] = useState(w.funcion_habitual || '');
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cambiado = n !== w.nombre || t !== w.tipo || e !== w.estado || fi !== (w.fecha_inicio || '') || (t === 'vendimiador' ? fh : '') !== (w.funcion_habitual || '');
  async function guardar() {
    if (!n.trim()) { setMsg({ t: 'err', m: 'El nombre no puede estar vacío' }); return; }
    const { error } = await sb.from('trabajadores').update({ nombre: n.trim(), tipo: t, estado: e, fecha_inicio: fi || null, funcion_habitual: t === 'vendimiador' && fh ? fh : null }).eq('id', w.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    const { data } = await sb.from('trabajadores').select('nombre,tipo,estado,fecha_inicio,funcion_habitual').eq('id', w.id).single();
    if (!data || data.nombre !== n.trim() || data.tipo !== t || data.estado !== e || (data.fecha_inicio || '') !== fi || (data.funcion_habitual || '') !== (t === 'vendimiador' ? fh : '')) { setMsg({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return; }
    setMsg({ t: 'ok', m: 'Guardado ✔' }); onSaved();
  }
  return (<tr>
    <td><input disabled={!admin} value={n} onChange={x => setN(x.target.value)} /></td>
    <td><select disabled={!admin} value={t} onChange={x => setT(x.target.value)}><option value="peon">Peón</option><option value="vendimiador">Vendimiador</option><option value="jefe">Jefe</option><option value="gerente">Gerente</option></select>{t === 'vendimiador' && <select style={{ marginTop: 4 }} disabled={!admin} value={fh} onChange={x => setFh(x.target.value)} title="Función habitual en vendimia"><option value="">Función: sin fijar</option><option value="coupeur">Cortador</option><option value="porteur">Porteur</option></select>}</td>
    <td><select disabled={!admin} value={e} onChange={x => setE(x.target.value)}><option value="activo">Activo</option><option value="baja">Baja</option></select></td>
    <td><input type="date" disabled={!admin} value={fi} onChange={x => setFi(x.target.value)} /></td>
    <td>{f2(w.horas)} h</td><td>{w.dias}</td><td>{w.p > 0 ? <span className="pbadge">P {w.p}</span> : ''}</td>
    <td>{admin && <button className="btn btn-g" disabled={!cambiado} onClick={guardar}>Guardar</button>}{msg && <div className={'msg ' + msg.t} style={{ marginTop: 4 }}>{msg.m}</div>}</td>
  </tr>);
}

function Contenido({ perfil }: { perfil: Perfil }) {
  const admin = perfil.rol === 'admin';
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [solo, setSolo] = useState(true);
  const [nn, setNn] = useState(''); const [nt, setNt] = useState('peon'); const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cargar = useCallback(async () => {
    try {
      const tr = await todas((a, b) => sb.from('trabajadores').select('id,nombre,tipo,estado,fecha_inicio,funcion_habitual').is('borrado_en', null).order('nombre').range(a, b));
      const ho = await todas((a, b) => sb.from('jornada_trabajador').select('trabajador_id,horas_normal,horas_extra,ausente,funcion').is('borrado_en', null).eq('confirmado', true).range(a, b));
      const m: Record<string, { h: number; d: number; p: number }> = {};
      ho.forEach((r: any) => { if (r.ausente) return; const x = (m[r.trabajador_id] ||= { h: 0, d: 0, p: 0 }); x.h += Number(r.horas_normal) + Number(r.horas_extra); x.d++; if (r.funcion === 'porteur') x.p++; });
      setRows(tr.map((w: any) => ({ ...w, horas: m[w.id]?.h || 0, dias: m[w.id]?.d || 0, p: m[w.id]?.p || 0 })));
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  async function crear() {
    setMsg(null); if (!nn.trim()) { setMsg({ t: 'err', m: 'Pon un nombre' }); return; }
    const { data, error } = await sb.from('trabajadores').insert({ nombre: nn.trim(), tipo: nt }).select('id,nombre').single();
    if (error || !data) { setMsg({ t: 'err', m: error?.message || 'No se creó' }); return; }
    setMsg({ t: 'ok', m: `«${data.nombre}» creado ✔` }); setNn(''); cargar();
  }
  const vis = (rows || []).filter(w => w.nombre.toLowerCase().includes(q.toLowerCase()) && (!solo || w.estado === 'activo'));
  return (<>
    <h2 style={{ marginBottom: 10 }}>Trabajadores</h2>
    {!admin && <div className="msg ok">Solo lectura: los cambios los hace un administrador.</div>}
    {admin && <div className="card"><h3>Nuevo trabajador</h3><div className="row">
      <div className="field"><label>Nombre</label><input value={nn} onChange={e => setNn(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 190 }}><label>Tipo</label><select value={nt} onChange={e => setNt(e.target.value)}><option value="peon">Peón</option><option value="vendimiador">Vendimiador</option><option value="jefe">Jefe</option><option value="gerente">Gerente</option></select></div>
      <button className="btn btn-g" onClick={crear}>Crear</button></div>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}</div>}
    <div className="card"><div className="row" style={{ marginBottom: 8 }}>
      <div className="field" style={{ maxWidth: 260 }}><input placeholder="Buscar trabajador…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <label style={{ margin: 0 }}><input type="checkbox" checked={solo} onChange={e => setSolo(e.target.checked)} /> Solo activos</label></div>
      {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
      {rows && <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Horas</th><th>Días</th><th>P</th><th></th></tr></thead><tbody>{vis.map(w => <Fila key={w.id} w={w} admin={admin} onSaved={cargar} />)}</tbody></table></div>}
      {rows && <div className="muted" style={{ marginTop: 6 }}>{vis.length} trabajadores · «Baja» los oculta del fichaje sin borrar su historial</div>}</div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido perfil={p} />}</Shell>; }
