'use client';
import { useEffect, useMemo, useState } from 'react';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, hoy, todas } from '@/lib/supabase';
import ReleveDoc, { MESES_FR, nf, fechaCorta, periodoFr, type Datos } from '@/lib/ReleveDoc';

const mesIso = (y: number, m: number) => [`${y}-${String(m).padStart(2, '0')}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];

function Contenido({ rol }: { rol: string }) {
  const d = new Date();
  const [clientes, setClientes] = useState<any[]>([]); const [cid, setCid] = useState('');
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1);
  const [borrador, setBorrador] = useState(false);
  const [filas, setFilas] = useState<any[] | null>(null); const [err, setErr] = useState('');
  const [rv, setRv] = useState<any | null>(null); const [aviso, setAviso] = useState(''); const [ocupado, setOcupado] = useState(false); const [rk, setRk] = useState(0);

  useEffect(() => { sb.from('clientes').select('id,nombre').is('borrado_en', null).order('nombre').then(({ data }) => setClientes(data || [])); }, []);
  useEffect(() => { (async () => {
    setFilas(null); setErr(''); if (!cid) return;
    try {
      const [a, b] = mesIso(y, m);
      const data = await todas((x, z) => sb.from('jornada_trabajador')
        .select('trabajador_id,horas_normal,horas_extra,jornadas!inner(id,fecha,estado,borrado_en,tareas!inner(cliente_id,servicios(nombre),proyectos(nombre)))')
        .is('borrado_en', null).eq('confirmado', true).eq('ausente', false)
        .eq('jornadas.tareas.cliente_id', cid).is('jornadas.borrado_en', null)
        .gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z));
      setFilas(data);
    } catch (e: any) { setErr(e.message || 'Error al cargar'); }
  })(); }, [cid, y, m]);

  const doc = useMemo(() => {
    if (!filas) return null;
    const dias: Record<string, { fecha: string; prest: string; proy: string; porTrab: Record<string, number>; hayBorrador: boolean }> = {};
    let hayBorrador = false;
    for (const l of filas) {
      const j = l.jornadas; const h = Number(l.horas_normal || 0) + Number(l.horas_extra || 0);
      if (!j || h <= 0) continue;
      const val = j.estado === 'validada';
      if (!val && !(borrador && j.estado === 'fichada')) continue;
      if (!val) hayBorrador = true;
      const prest = j.tareas?.servicios?.nombre || 'Prestation'; const proy = j.tareas?.proyectos?.nombre || '';
      const k = j.fecha + '|' + prest + '|' + proy;
      const r = (dias[k] ||= { fecha: j.fecha, prest, proy, porTrab: {}, hayBorrador: false });
      r.porTrab[l.trabajador_id] = (r.porTrab[l.trabajador_id] || 0) + h; if (!val) r.hayBorrador = true;
    }
    const lineas = Object.values(dias).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.prest.localeCompare(b.prest)).map(r => {
      const hs = Object.values(r.porTrab); const total = hs.reduce((s, x) => s + x, 0);
      const grupos: Record<string, number> = {}; hs.forEach(x => { grupos[nf(x)] = (grupos[nf(x)] || 0) + 1; });
      const detalle = Object.entries(grupos).sort((a, b) => Number(b[0].replace(',', '.')) - Number(a[0].replace(',', '.'))).map(([h, n]) => `${h} h × ${n}`).join(' + ');
      return { ...r, nb: hs.length, total, detalle };
    });
    const totalH = lineas.reduce((s, r) => s + r.total, 0);
    const jours = new Set(lineas.map(r => r.fecha)).size;
    return { lineas, totalH, jours, hayBorrador };
  }, [filas, borrador]);

  useEffect(() => { (async () => {
    setRv(null); if (!cid) return;
    const { data } = await sb.from('releves').select('*').eq('cliente_id', cid).eq('mes', mesIso(y, m)[0]).is('borrado_en', null).maybeSingle();
    setRv(data || null);
  })(); }, [cid, y, m, rk]);
  const actuar = async (fn: string, args: any, ok: string) => {
    setOcupado(true); setAviso('');
    const { error } = await sb.rpc(fn, args);
    setOcupado(false);
    if (error) { setAviso('❌ ' + error.message); return; }
    setAviso(ok); setRk(k => k + 1);
  };
  const mes1 = mesIso(y, m)[0];
  const cliente = clientes.find(c => c.id === cid);
  const periodo = periodoFr(y, m);
  const snap = rv?.datos as (Datos & { totalH: number }) | undefined;
  const difiere = !!(rv && doc && !borrador && snap && (Math.abs(snap.totalH - doc.totalH) > 0.001 || snap.lineas.length !== doc.lineas.length));
  const puedeRevisar = !!(doc && doc.lineas.length && !doc.hayBorrador && !borrador && rv?.estado !== 'publicado');

  return (<>
    <div className="noprint">
      <h2 style={{ marginBottom: 4 }}>Relevé d'heures</h2>
      <div className="muted" style={{ marginBottom: 10 }}>Documento para el cliente (en francés): días trabajados, nº de trabajadores y horas. Solo cuenta lo <b>validado</b>. Para guardarlo, pulsa Imprimir y elige «Guardar como PDF».</div>
      <div className="card row">
        <div className="field" style={{ minWidth: 240 }}><label>Cliente</label><select value={cid} onChange={e => setCid(e.target.value)}><option value="">— elegir —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 130 }}><label>Mes</label><select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString(loc(), { month: 'long' })}</option>)}</select></div>
        <div className="field" style={{ maxWidth: 110 }}><label>Año</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} /></div>
        <label style={{ margin: 0 }}><input type="checkbox" checked={borrador} onChange={e => setBorrador(e.target.checked)} /> Incluir jornadas fichadas sin validar (borrador)</label>
        <button className="btn btn-g" disabled={!doc || !doc.lineas.length} onClick={() => window.print()}>🖨 Imprimir / PDF</button>
      </div>
      {err && <div className="msg err">{err}</div>}
      {cid && !filas && !err && <div className="muted">Cargando…</div>}
      {cid && filas && <div className="card">
        <b>Validación del relevé · {periodo}</b>
        <div className="muted" style={{ margin: '4px 0 8px' }}>
          {!rv && 'Sin revisar. 1.º la secretaria (o el admin) lo revisa; 2.º el admin lo publica y el cliente lo ve en su espacio.'}
          {rv?.estado === 'revisado' && `✔ Revisado el ${fechaCorta(rv.revisado_en.slice(0, 10))}. Falta la validación final del administrador.`}
          {rv?.estado === 'publicado' && `✅ Publicado al cliente el ${fechaCorta(rv.publicado_en.slice(0, 10))}. El cliente lo ve en su espacio.`}
        </div>
        {difiere && <div className="msg err">⚠ Las horas validadas han cambiado desde la revisión. Se publicaría la versión revisada ({nf(snap!.totalH)} h); la actual suma {nf(doc!.totalH)} h. Vuelve a revisar si quieres actualizarla.</div>}
        <div className="row">
          {rv?.estado !== 'publicado' && <button className="btn" disabled={!puedeRevisar || ocupado} onClick={() => actuar('releve_revisar', { p_cliente: cid, p_mes: mes1, p_datos: { lineas: doc!.lineas.map(({ fecha, prest, proy, nb, total, detalle }) => ({ fecha, prest, proy, nb, total, detalle })), totalH: doc!.totalH, jours: doc!.jours } }, '✔ Relevé revisado.')}>{rv ? '🔄 Volver a revisar' : '✔ Marcar como revisado'}</button>}
          {rol === 'admin' && rv?.estado === 'revisado' && <button className="btn btn-g" disabled={ocupado} onClick={() => { if (confirm('¿Publicar este relevé al cliente? Lo verá en su espacio.')) actuar('releve_publicar', { p_cliente: cid, p_mes: mes1 }, '✅ Publicado al cliente.'); }}>✅ Validar y publicar al cliente</button>}
          {rol === 'admin' && rv && <button className="btn" disabled={ocupado} onClick={() => { if (confirm('¿Retirar este relevé? El cliente dejará de verlo y habrá que revisarlo de nuevo.')) actuar('releve_reabrir', { p_cliente: cid, p_mes: mes1 }, 'Relevé reabierto.'); }}>↩ Reabrir</button>}
        </div>
        {!puedeRevisar && rv?.estado !== 'publicado' && <div className="muted" style={{ marginTop: 6 }}>Para revisar: quita el borrador y que haya jornadas validadas ese mes.</div>}
        {aviso && <div className="msg" style={{ marginTop: 6 }}>{aviso}</div>}
      </div>}
    </div>

    {cid && doc && <ReleveDoc cliente={cliente?.nombre || ''} periodo={periodo} editado={fechaCorta(hoy())} d={doc} />}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{p => <Contenido rol={p.rol} />}</Shell>; }
