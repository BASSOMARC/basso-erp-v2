'use client';
import { useEffect, useMemo, useState } from 'react';
import Shell from '@/lib/Shell';
import { loc } from '@/lib/i18n';
import { sb, hoy, todas } from '@/lib/supabase';
import { LOGO_RELEVE } from '@/lib/logo-releve';

/* Datos de la empresa para el documento (se imprime siempre en francés) */
const EMPRESA = {
  nombre: 'BASSO SERVICES VITICOLES', forma: 'SARL',
  direccion: '189 avenue du Maréchal Foch, 33500 Libourne',
  siret: '908 479 975 00041', rcs: 'R.C.S. Libourne 908 479 975', tva: 'FR91908479975',
  email: 'contact@bassoviti.com', tel: '06 38 73 39 50',
};
const MESES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const mesIso = (y: number, m: number) => [`${y}-${String(m).padStart(2, '0')}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
const nf = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const hh = (n: number) => nf(n) + ' h';
const fechaFr = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const dd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''); return dd + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); };

function Contenido() {
  const d = new Date();
  const [clientes, setClientes] = useState<any[]>([]); const [cid, setCid] = useState('');
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1);
  const [borrador, setBorrador] = useState(false);
  const [filas, setFilas] = useState<any[] | null>(null); const [err, setErr] = useState('');

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

  const cliente = clientes.find(c => c.id === cid);
  const periodo = MESES_FR[m - 1].charAt(0).toUpperCase() + MESES_FR[m - 1].slice(1) + ' ' + y;

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
    </div>

    {cid && doc && <div className="releve">
      <div className="rv-head">
        <img src={LOGO_RELEVE} alt="Basso Services Viticoles" className="rv-logo" />
        <div className="rv-emp">
          <b>{EMPRESA.forma} {EMPRESA.nombre}</b><br />{EMPRESA.direccion}<br />
          SIRET {EMPRESA.siret} · {EMPRESA.rcs}<br />N° TVA intracommunautaire {EMPRESA.tva}<br />{EMPRESA.email} · Tél. {EMPRESA.tel}
        </div>
      </div>
      <h1 className="rv-tit">RELEVÉ D'HEURES</h1>
      <div className="rv-meta"><div><span>Client</span><b>{cliente?.nombre}</b></div><div><span>Période</span><b>{periodo}</b></div><div><span>Édité le</span><b>{hoy().slice(8, 10) + '/' + hoy().slice(5, 7) + '/' + hoy().slice(0, 4)}</b></div></div>
      {doc.hayBorrador && <div className="rv-borr">BROUILLON — contient des journées non validées. Ne pas envoyer au client.</div>}
      {doc.lineas.length === 0 ? <div className="rv-vacio">Aucune journée validée pour cette période.</div> : <>
        <table className="rv-tab">
          <thead><tr><th>Date</th><th>Prestation</th><th className="c">Nb ouvriers</th><th className="c">Heures par ouvrier</th><th className="r">Total du jour</th></tr></thead>
          <tbody>{doc.lineas.map((r, i) => <tr key={i}><td>{fechaFr(r.fecha)}</td><td>{r.prest}{r.proy && <div className="rv-sub">{r.proy}</div>}</td><td className="c">{r.nb}</td><td className="c">{r.detalle}</td><td className="r"><b>{hh(r.total)}</b></td></tr>)}</tbody>
          <tfoot><tr><td colSpan={4}>TOTAL GÉNÉRAL DES HEURES — {doc.jours} jour{doc.jours > 1 ? 's' : ''} d'intervention</td><td className="r">{hh(doc.totalH)}</td></tr></tfoot>
        </table>
        <div className="rv-firmas"><div><span>Basso Services Viticoles</span></div><div><span>Le client — bon pour accord (date, signature, cachet)</span></div></div>
      </>}
    </div>}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
