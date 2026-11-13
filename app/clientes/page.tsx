'use client';
import { useEffect, useState, useCallback } from 'react';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, todas } from '@/lib/supabase';
const f2 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 2 });

function Fila({ c, admin, onSaved }: any) {
  const [n, setN] = useState(c.nombre); const [t, setT] = useState(c.tipo); const [no, setNo] = useState(c.notas || ''); const [nf, setNf] = useState<boolean>(!!c.no_facturable);
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cambiado = n !== c.nombre || t !== c.tipo || no !== (c.notas || '') || nf !== !!c.no_facturable;
  async function guardar() {
    if (!n.trim()) { setMsg({ t: 'err', m: 'El nombre no puede estar vacío' }); return; }
    const { error } = await sb.from('clientes').update({ nombre: n.trim(), tipo: t, notas: no || null, no_facturable: nf }).eq('id', c.id);
    if (error) { setMsg({ t: 'err', m: error.message }); return; }
    const { data } = await sb.from('clientes').select('nombre,tipo,notas,no_facturable').eq('id', c.id).single();
    if (!data || data.nombre !== n.trim() || data.tipo !== t || (data.notas || '') !== no || data.no_facturable !== nf) { setMsg({ t: 'err', m: 'El servidor devolvió otros valores. NO está guardado.' }); return; }
    setMsg({ t: 'ok', m: 'Guardado ✔' }); onSaved();
  }
  return (<tr>
    <td><input value={n} onChange={e => setN(e.target.value)} /></td>
    <td><select value={t} onChange={e => setT(e.target.value)}><option value="particular">Particular</option><option value="cooperativa">Cooperativa</option></select></td>
    <td><input value={no} onChange={e => setNo(e.target.value)} placeholder="Notas" /></td>
    <td><label style={{ margin: 0 }} title="Fermage: no se factura, el ingreso llega al vender la uva"><input type="checkbox" disabled={!admin} checked={nf} onChange={e => setNf(e.target.checked)} /> sin factura</label></td><td>{f2(c.horas)} h</td><td>{c.proyectos}</td>
    <td><button className="btn btn-g" disabled={!cambiado} onClick={guardar}>Guardar</button>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 4 }}>{msg.m}</div>}</td>
  </tr>);
}

function Contenido({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [q, setQ] = useState('');
  const [nn, setNn] = useState(''); const [nt, setNt] = useState('particular'); const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null);
  const cargar = useCallback(async () => {
    try {
      const cl = await todas((a, b) => sb.from('clientes').select('id,nombre,tipo,notas,no_facturable').is('borrado_en', null).order('nombre').range(a, b));
      const ho = await todas((a, b) => sb.from('jornada_trabajador').select('horas_normal,horas_extra,ausente,jornadas!inner(tareas(cliente_id))').is('borrado_en', null).eq('ausente', false).range(a, b));
      const pr = await todas((a, b) => sb.from('proyectos').select('id,cliente_id').is('borrado_en', null).range(a, b));
      const h: Record<string, number> = {}; ho.forEach((r: any) => { const k = r.jornadas?.tareas?.cliente_id; if (k) h[k] = (h[k] || 0) + Number(r.horas_normal) + Number(r.horas_extra); });
      const p: Record<string, number> = {}; pr.forEach((r: any) => { p[r.cliente_id] = (p[r.cliente_id] || 0) + 1; });
      setRows(cl.map((c: any) => ({ ...c, horas: h[c.id] || 0, proyectos: p[c.id] || 0 })));
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  async function crear() {
    setMsg(null); if (!nn.trim()) { setMsg({ t: 'err', m: 'Pon un nombre' }); return; }
    const { data, error } = await sb.from('clientes').insert({ nombre: nn.trim(), tipo: nt }).select('id,nombre').single();
    if (error || !data) { setMsg({ t: 'err', m: error?.message || 'No se creó' }); return; }
    setMsg({ t: 'ok', m: `Cliente «${data.nombre}» creado ✔` }); setNn(''); cargar();
  }
  const vis = (rows || []).filter(c => c.nombre.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <h2 style={{ marginBottom: 10 }}>Clientes</h2>
    <div className="card"><h3>Nuevo cliente</h3><div className="row">
      <div className="field"><label>Nombre</label><input value={nn} onChange={e => setNn(e.target.value)} /></div>
      <div className="field" style={{ maxWidth: 170 }}><label>Tipo</label><select value={nt} onChange={e => setNt(e.target.value)}><option value="particular">Particular</option><option value="cooperativa">Cooperativa</option></select></div>
      <button className="btn btn-g" onClick={crear}>Crear</button></div>{msg && <div className={'msg ' + msg.t} style={{ marginTop: 8 }}>{msg.m}</div>}</div>
    <div className="card"><div className="field" style={{ maxWidth: 260, marginBottom: 8 }}><input placeholder="Buscar cliente…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {err && <div className="msg err">{err}</div>}{!rows && !err && <div className="muted">Cargando…</div>}
      {rows && <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Notas</th><th>Fermage</th><th>Horas</th><th>Proy.</th><th></th></tr></thead><tbody>{vis.map(c => <Fila key={c.id} c={c} admin={admin} onSaved={cargar} />)}</tbody></table></div>}
      {rows && <div className="muted" style={{ marginTop: 6 }}>{vis.length} clientes</div>}</div>
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{(p) => <Contenido admin={p.rol === 'admin'} />}</Shell>; }
