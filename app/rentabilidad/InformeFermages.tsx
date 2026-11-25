'use client';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { loc } from '@/lib/i18n';
import { sb, todas } from '@/lib/supabase';

const eur = (n: number) => n.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const f1 = (n: number) => n.toLocaleString(loc(), { maximumFractionDigits: 1 });
const mes = (y: number, m: number) => [`${y}-${String(m).padStart(2, '0')}-01`, m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`];
const vig = (lista: any[], fecha: string) => lista.find(x => x.desde <= fecha);
const csvCell = (v: any) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const bajar = (nombre: string, filas: any[][]) => {
  const blob = new Blob(['﻿' + filas.map(l => l.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click(); URL.revokeObjectURL(a.href);
};

export default function InformeFermages() {
  const d = new Date();
  const [y, setY] = useState(d.getFullYear()); const [m, setM] = useState(d.getMonth() + 1); const [soloVal, setSoloVal] = useState(true);
  const [todosCli, setTodosCli] = useState(false); const [cli, setCli] = useState('');
  const [data, setData] = useState<any>(null); const [err, setErr] = useState(''); const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => { (async () => {
    setData(null); setErr('');
    try {
      const [a, b] = mes(y, m);
      const emb = 'tareas(cliente_id,servicios(nombre),proyectos(nombre),clientes(nombre,no_facturable))';
      const [lin, coste, prima, rec] = await Promise.all([
        todas((x, z) => sb.from('jornada_trabajador').select(`id,horas_normal,horas_extra,funcion,trabajadores(tipo),jornadas!inner(id,fecha,estado,${emb})`).is('borrado_en', null).eq('confirmado', true).eq('ausente', false).is('jornadas.borrado_en', null).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)),
        sb.from('coste_hora').select('*').order('desde', { ascending: false }),
        sb.from('prima_porteur').select('*').order('desde', { ascending: false }),
        todas((x, z) => sb.from('jt_recargo').select('id,h_recargo').gte('fecha', a).lt('fecha', b).order('id').range(x, z)),
      ]);
      if (coste.error) throw coste.error; if (prima.error) throw prima.error;
      setData({ lin, coste: coste.data || [], prima: prima.data || [], rec: new Map(rec.map((x: any) => [x.id, Number(x.h_recargo)])) });
    } catch (e: any) { setErr(e.message); }
  })(); }, [y, m]);

  const res = useMemo(() => {
    if (!data) return null;
    const dias: Record<string, any> = {}; const clientes: Record<string, string> = {}; let sinCoste = 0;
    data.lin.forEach((r: any) => {
      const j = r.jornadas; if (!j || (soloVal && j.estado !== 'validada')) return; const t = j.tareas; if (!t) return;
      if (!todosCli && !t.clientes?.no_facturable) return;
      const h = Number(r.horas_normal) + Number(r.horas_extra); if (h <= 0) return;
      const tipo = r.trabajadores?.tipo || 'peon';
      const ch = vig(data.coste.filter((x: any) => x.tipo_trabajador === tipo), j.fecha) || vig(data.coste.filter((x: any) => x.tipo_trabajador === 'peon'), j.fecha); if (!ch) sinCoste++;
      const rc = data.rec.get(r.id) || 0; let c = (h + rc) * Number(ch?.euros_hora || 0); if (r.funcion === 'porteur') c += Number(vig(data.prima, j.fecha)?.euros_dia || 0);
      const cn = t.clientes?.nombre || '—'; clientes[t.cliente_id] = cn;
      const pr = t.proyectos?.nombre || 'Sin proyecto'; const sv = t.servicios?.nombre || 'Sin servicio';
      const k = [j.fecha, t.cliente_id, pr, sv].join('|');
      const x = (dias[k] ||= { fecha: j.fecha, cid: t.cliente_id, cli: cn, proy: pr, serv: sv, nb: 0, horas: 0, coste: 0 });
      x.nb++; x.horas += h; x.coste += c; x.rec = (x.rec || 0) + rc * Number(ch?.euros_hora || 0);
    });
    const det = Object.values<any>(dias).filter(x => !cli || x.cid === cli).sort((a, b) => a.cli.localeCompare(b.cli) || a.proy.localeCompare(b.proy) || a.fecha.localeCompare(b.fecha));
    const g: Record<string, any> = {};
    det.forEach(x => { const f = (g[x.cli] ||= { nombre: x.cli, horas: 0, coste: 0, proy: {} as Record<string, any> }); const p = (f.proy[x.proy] ||= { nombre: x.proy, horas: 0, coste: 0, dias: new Set<string>(), serv: {} as Record<string, any> });
      const s = (p.serv[x.serv] ||= { horas: 0, coste: 0 }); f.horas += x.horas; f.coste += x.coste; p.horas += x.horas; p.coste += x.coste; p.dias.add(x.fecha); s.horas += x.horas; s.coste += x.coste; });
    const fil = Object.values<any>(g).sort((a, b) => b.coste - a.coste);
    return { det, fil, tot: { horas: fil.reduce((s, f) => s + f.horas, 0), coste: fil.reduce((s, f) => s + f.coste, 0) }, clientes, sinCoste };
  }, [data, soloVal, todosCli, cli]);

  const mesTxt = new Date(y, m - 1, 1).toLocaleString(loc(), { month: 'long' });
  const exportar = () => {
    if (!res) return;
    const l: any[][] = [['Fermage', 'Proyecto', 'Prestación', 'Fecha', 'Nº trabajadores', 'Horas', 'Coste (€)', 'del cual recargo horas extra (€)']];
    res.det.forEach(x => l.push([x.cli, x.proy, x.serv, x.fecha, x.nb, num(x.horas), num(x.coste), num(x.rec || 0)]));
    l.push([]); l.push(['RESUMEN POR FERMAGE Y PROYECTO']); l.push(['Fermage', 'Proyecto', 'Días', 'Horas', 'Coste (€)']);
    res.fil.forEach(f => { Object.values<any>(f.proy).forEach(p => l.push([f.nombre, p.nombre, p.dias.size, num(p.horas), num(p.coste)])); l.push([f.nombre, 'TOTAL', '', num(f.horas), num(f.coste)]); });
    l.push(['TOTAL GENERAL', '', '', num(res.tot.horas), num(res.tot.coste)]);
    bajar(`costes-fermages-${y}-${String(m).padStart(2, '0')}.csv`, l);
  };

  return (<>
    <div className="muted" style={{ marginBottom: 10 }}>Coste mensual de mano de obra por fermage y proyecto (horas × coste por hora con cargas sociales, más recargo de horas extra: +25 % de 35 a 40 h y +50 % de 40 a 45 h por semana). Se puede descargar para abrir en Excel.</div>
    <div className="card row">
      <div className="field" style={{ maxWidth: 130 }}><label>Mes</label><select value={m} onChange={e => setM(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2000, i, 1).toLocaleString(loc(), { month: 'long' })}</option>)}</select></div>
      <div className="field" style={{ maxWidth: 110 }}><label>Año</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} /></div>
      <div className="field" style={{ minWidth: 220 }}><label>Fermage</label><select value={cli} onChange={e => setCli(e.target.value)}><option value="">Todos</option>{res && Object.entries(res.clientes).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
      <label style={{ margin: 0 }}><input type="checkbox" checked={soloVal} onChange={e => setSoloVal(e.target.checked)} /> Solo jornadas validadas</label>
      <label style={{ margin: 0 }}><input type="checkbox" checked={todosCli} onChange={e => { setTodosCli(e.target.checked); setCli(''); }} /> Incluir también clientes que se facturan</label>
      <button className="btn btn-g" disabled={!res || !res.det.length} onClick={exportar}>⬇ Descargar para Excel</button>
    </div>
    {err && <div className="msg err">{err}</div>}{!res && !err && <div className="muted">Cargando…</div>}
    {res && res.sinCoste > 0 && <div className="msg err">Hay {res.sinCoste} líneas sin coste por hora definido; salen a 0 €.</div>}
    {res && <>
      <div className="kpis">
        <div className="kpi"><div className="kn">{eur(res.tot.coste)}</div><div className="kl">Coste de {mesTxt} {y}</div></div>
        <div className="kpi"><div className="kn">{f1(res.tot.horas)}</div><div className="kl">Horas</div></div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        {res.fil.length === 0 ? <div className="muted">Sin datos este mes{soloVal ? ' (prueba a incluir jornadas no validadas)' : ''}.</div> :
          <table><thead><tr><th>Fermage / proyecto</th><th>Días</th><th>Horas</th><th>Coste</th></tr></thead><tbody>
            {res.fil.map(f => { const abre = abierto === f.nombre; return (<Fragment key={f.nombre}>
              <tr style={{ cursor: 'pointer' }} onClick={() => setAbierto(abre ? null : f.nombre)}><td><b>{abre ? '▾' : '▸'} {f.nombre}</b></td><td></td><td>{f1(f.horas)}</td><td><b>{eur(f.coste)}</b></td></tr>
              {abre && Object.values<any>(f.proy).map(p => <Fragment key={f.nombre + p.nombre}>
                <tr className="pend"><td style={{ paddingLeft: 24 }}>{p.nombre}</td><td>{p.dias.size}</td><td>{f1(p.horas)}</td><td>{eur(p.coste)}</td></tr>
                {Object.entries<any>(p.serv).map(([n, s]) => <tr key={f.nombre + p.nombre + n} className="pend"><td style={{ paddingLeft: 48 }} className="muted">{n}</td><td></td><td>{f1(s.horas)}</td><td>{eur(s.coste)}</td></tr>)}
              </Fragment>)}
            </Fragment>); })}
          </tbody></table>}
      </div>
    </>}
  </>);
}
