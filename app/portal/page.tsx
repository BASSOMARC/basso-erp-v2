'use client';
import { useEffect, useState } from 'react';
import Shell from '@/lib/Shell';
import { sb } from '@/lib/supabase';

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
const nf = (n: number) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const UN: Record<string, string> = { cepa: 'pieds', cepas: 'pieds', kg: 'kg', ha: 'ha', hora: 'h' };
const EST: Record<string, string> = { activo: 'En cours', en_curso: 'En cours', terminado: 'Terminé', finalizado: 'Terminé', pausa: 'En pause', pausado: 'En pause', pendiente: 'À venir', planificado: 'À venir' };

function Contenido() {
  const [info, setInfo] = useState<string>('');
  const [js, setJs] = useState<any[] | null>(null);
  const [ps, setPs] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { (async () => {
    const [a, b, c] = await Promise.all([sb.rpc('portal_info'), sb.rpc('portal_jornadas'), sb.rpc('portal_proyectos')]);
    if (a.error || b.error || c.error) { setErr((a.error || b.error || c.error)!.message); return; }
    setInfo(a.data?.[0]?.cliente || ''); setJs(b.data || []); setPs(c.data || []);
  })(); }, []);
  if (err) return <div className="msg err">Une erreur est survenue : {err}</div>;
  if (!js || !ps) return <div className="muted">Chargement…</div>;
  const totalH = js.reduce((s, j) => s + Number(j.horas), 0);
  return (<>
    <h2 style={{ marginBottom: 4 }}>Espace client{info ? ' · ' + info : ''}</h2>
    <p className="muted" style={{ marginBottom: 14 }}>Les interventions apparaissent ici une fois contrôlées et validées par Basso Services Viticoles.</p>

    <div className="kpis">
      <div className="kpi"><div className="n">{js.length}</div><div>Interventions validées</div></div>
      <div className="kpi"><div className="n">{nf(totalH)} h</div><div>Heures réalisées</div></div>
      <div className="kpi"><div className="n">{ps.length}</div><div>Chantiers</div></div>
    </div>

    <h3 style={{ margin: '16px 0 8px' }}>Avancement des chantiers</h3>
    {ps.length === 0 && <div className="card muted">Aucun chantier pour le moment.</div>}
    {ps.map((p, i) => {
      const pct = p.objetivo > 0 ? Math.min(100, Math.round(Number(p.avance) / Number(p.objetivo) * 100)) : null;
      const u = UN[p.unidad] || p.unidad || '';
      return (<div className="card" key={i}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>{p.proyecto}</b><span className="muted">{EST[p.estado] || p.estado}</span>
        </div>
        {pct !== null && <>
          <div style={{ background: 'var(--pl)', borderRadius: 6, height: 10, margin: '8px 0 4px', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: 'var(--p)' }} /></div>
          <div className="muted">{nf(p.avance)} / {nf(p.objetivo)} {u} · {pct} %</div>
        </>}
        {pct === null && Number(p.avance) > 0 && <div className="muted">{nf(p.avance)} {u} réalisés</div>}
        <div className="muted">{nf(p.horas)} h travaillées</div>
      </div>);
    })}

    <h3 style={{ margin: '16px 0 8px' }}>Interventions validées</h3>
    {js.length === 0 && <div className="card muted">Aucune intervention validée pour le moment.</div>}
    {js.length > 0 && <div className="card" style={{ overflowX: 'auto' }}><table>
      <thead><tr><th>Date</th><th>Prestation</th><th>Chantier</th><th>Personnes</th><th>Heures</th><th>Réalisé</th></tr></thead>
      <tbody>{js.map((j, i) => (<tr key={i}>
        <td>{fmtDate(j.fecha)}</td><td>{j.servicio}</td><td>{j.proyecto || '—'}</td><td>{j.personas}</td><td>{nf(j.horas)} h</td>
        <td>{j.cantidad != null ? `${nf(j.cantidad)} ${UN[j.unidad] || j.unidad || ''}` : '—'}</td></tr>))}</tbody>
    </table></div>}
    <p className="muted" style={{ marginTop: 12 }}>Une question ? contact@bassosv.fr · 06 38 73 39 50</p>
  </>);
}
export default function Portal() { return <Shell roles={['cliente']}>{() => <Contenido />}</Shell>; }
