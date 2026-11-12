'use client';
import { useEffect, useState, useMemo } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas } from '@/lib/supabase';

const pad = (n: number) => String(n).padStart(2, '0');
const f2 = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 2 });

function Contenido() {
  const hoy = new Date();
  const [y, setY] = useState(hoy.getFullYear()); const [m, setM] = useState(hoy.getMonth() + 1);
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { (async () => {
    setRows(null); setErr(''); setSel(null);
    const a = `${y}-${pad(m)}-01`; const b = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    try {
      setRows(await todas((x, z) => sb.from('jornada_trabajador')
        .select('horas_normal,horas_extra,ausente,funcion,confirmado,trabajadores(nombre),jornadas!inner(fecha,estado,tareas(nombre,clientes(nombre)))')
        .is('borrado_en', null).gte('jornadas.fecha', a).lt('jornadas.fecha', b).order('id').range(x, z)));
    } catch (e: any) { setErr(e.message); }
  })(); }, [y, m]);
  const porDia = useMemo(() => {
    const o: Record<string, { h: number; n: number; p: number; aus: number; pend: number; rows: any[] }> = {};
    (rows || []).forEach((r: any) => { const f = r.jornadas.fecha; const x = (o[f] ||= { h: 0, n: 0, p: 0, aus: 0, pend: 0, rows: [] }); x.rows.push(r);
      if (!r.confirmado) x.pend++; else if (r.ausente) x.aus++; else { x.n++; x.h += Number(r.horas_normal) + Number(r.horas_extra); if (r.funcion === 'porteur') x.p++; } });
    return o;
  }, [rows]);
  const primero = (new Date(y, m - 1, 1).getDay() + 6) % 7; const dias = new Date(y, m, 0).getDate();
  const celdas = [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const mover = (d: number) => { const n = new Date(y, m - 1 + d, 1); setY(n.getFullYear()); setM(n.getMonth() + 1); };
  const det = sel ? porDia[sel] : null;
  const grupos: Record<string, any[]> = {};
  det?.rows.forEach((r: any) => { const k = (r.jornadas.tareas?.clientes?.nombre || '—') + ' · ' + (r.jornadas.tareas?.nombre || '—'); (grupos[k] ||= []).push(r); });
  return (<>
    <h2 style={{ marginBottom: 10 }}>Calendario</h2>
    <div className="card row" style={{ justifyContent: 'space-between' }}>
      <button className="btn" onClick={() => mover(-1)}>◀</button>
      <b style={{ textTransform: 'capitalize' }}>{new Date(y, m - 1, 1).toLocaleString('es', { month: 'long', year: 'numeric' })}</b>
      <button className="btn" onClick={() => mover(1)}>▶</button>
    </div>
    {err && <div className="msg err">{err}</div>}
    {!rows && !err && <div className="muted">Cargando…</div>}
    {rows && <div className="cal">
      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="ch">{d}</div>)}
      {celdas.map((d, i) => { if (d === null) return <div key={i} className="cc vacio" />;
        const f = `${y}-${pad(m)}-${pad(d)}`; const x = porDia[f];
        return <div key={i} className={'cc' + (x ? ' con' : '') + (sel === f ? ' sel' : '')} onClick={() => x && setSel(f)}>
          <div className="cd">{d}</div>
          {x && <><div className="ch1">{f2(x.h)} h</div><div className="ch2">{x.n} pers.{x.pend > 0 ? ` +${x.pend} plan.` : ''}</div>{x.p > 0 && <span className="pbadge">P {x.p}</span>}</>}
        </div>; })}
    </div>}
    {det && <div className="card" style={{ marginTop: 12 }}>
      <h3>{new Date(sel + 'T00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      {Object.entries(grupos).map(([k, rs]) => <div key={k} style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{k}</div>
        <table><tbody>{rs.sort((a: any, b: any) => (a.trabajadores?.nombre || '').localeCompare(b.trabajadores?.nombre || '')).map((r: any, i: number) => <tr key={i}>
          <td>{r.trabajadores?.nombre}</td>
          <td>{!r.confirmado ? <span className="muted">asignado · sin confirmar</span> : r.ausente ? <span className="muted">ausente</span> : <>{f2(Number(r.horas_normal) + Number(r.horas_extra))} h</>}</td>
          <td>{r.funcion === 'porteur' && !r.ausente ? <span className="pbadge">P</span> : r.funcion === 'coupeur' && !r.ausente ? <span className="muted">C</span> : ''}</td>
        </tr>)}</tbody></table>
      </div>)}
    </div>}
  </>);
}
export default function Page() { return <Shell roles={['admin', 'secretaria']}>{() => <Contenido />}</Shell>; }
