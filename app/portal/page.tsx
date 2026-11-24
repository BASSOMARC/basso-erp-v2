'use client';
import { useEffect, useState } from 'react';
import Shell from '@/lib/Shell';
import { sb } from '@/lib/supabase';
import ReleveDoc, { periodoFr, fechaCorta } from '@/lib/ReleveDoc';

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
const nf = (n: number) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const UN: Record<string, string> = { cepa: 'pieds', cepas: 'pieds', kg: 'kg', ha: 'ha', hora: 'h' };
const EST: Record<string, string> = { activo: 'En cours', en_curso: 'En cours', terminado: 'Terminé', finalizado: 'Terminé', pausa: 'En pause', pausado: 'En pause', pendiente: 'À venir', planificado: 'À venir' };

function Contenido() {
  const [info, setInfo] = useState<string>('');
  const [js, setJs] = useState<any[] | null>(null);
  const [ps, setPs] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [rvs, setRvs] = useState<any[]>([]); const [abierto, setAbierto] = useState<string>(''); const [verRv, setVerRv] = useState<any | null>(null);
  useEffect(() => { (async () => {
    const [a, b, c, r] = await Promise.all([sb.rpc('portal_info'), sb.rpc('portal_jornadas'), sb.rpc('portal_proyectos'), sb.rpc('portal_releves')]);
    setRvs(r.data || []);
    if (a.error || b.error || c.error) { setErr((a.error || b.error || c.error)!.message); return; }
    setInfo(a.data?.[0]?.cliente || ''); setJs(b.data || []); setPs(c.data || []);
  })(); }, []);
  if (err) return <div className="msg err">Une erreur est survenue : {err}</div>;
  if (!js || !ps) return <div className="muted">Chargement…</div>;
  const totalH = js.reduce((s, j) => s + Number(j.horas), 0);
  const gm: Record<string, any[]> = {}; js.forEach(j => { (gm[j.fecha.slice(0, 7)] ||= []).push(j); });
  const meses = Object.entries(gm).sort((a, b) => b[0].localeCompare(a[0]));
  if (verRv) { const [yy, mm] = verRv.mes.split('-').map(Number); return (<>
    <div className="noprint row" style={{ marginBottom: 10 }}><button className="btn" onClick={() => setVerRv(null)}>← Retour</button><button className="btn btn-g" onClick={() => window.print()}>🖨 Imprimer / PDF</button></div>
    <ReleveDoc cliente={info} periodo={periodoFr(yy, mm)} editado={fechaCorta(verRv.publicado_en.slice(0, 10))} d={verRv.datos} />
  </>); }
  return (<>
    <h2 style={{ marginBottom: 4 }}>Espace client{info ? ' · ' + info : ''}</h2>
    <p className="muted" style={{ marginBottom: 14 }}>Le journal de nos interventions, mois par mois. Elles apparaissent ici une fois contrôlées et validées par Basso Services Viticoles, avec le relevé d'heures du mois.</p>

    <div className="kpis">
      <div className="kpi"><div className="n">{js.length}</div><div>Interventions validées</div></div>
      <div className="kpi"><div className="n">{nf(totalH)} h</div><div>Heures réalisées</div></div>
      <div className="kpi"><div className="n">{ps.length}</div><div>Chantiers</div></div>
    </div>

    <h3 style={{ margin: '16px 0 8px' }}>Avancement des chantiers</h3>
    {ps.length === 0 && <div className="card muted">Aucun chantier pour le moment.</div>}
    {ps.map((p, i) => {
      const pct = p.objetivo > 0 ? Math.min(100, Math.round(Number(p.avance) / Number(p.objetivo) * 100)) : null;
      const u = p.unidad === 'porcentaje' ? '' : (UN[p.unidad] || p.unidad || '');
      return (<div className="card" key={i}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <b>{p.proyecto}</b><span className="muted">{EST[p.estado] || p.estado}</span>
        </div>
        {pct !== null && <>
          <div style={{ background: 'var(--pl)', borderRadius: 6, height: 10, margin: '8px 0 4px', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: 'var(--p)' }} /></div>
          <div className="muted">{p.unidad === 'porcentaje' ? `${pct} %` : `${nf(p.avance)} / ${nf(p.objetivo)} ${u} · ${pct} %`}</div>
        </>}
        {pct === null && Number(p.avance) > 0 && <div className="muted">{nf(p.avance)} {u} réalisés</div>}
        <div className="muted">{nf(p.horas)} h travaillées</div>
      </div>);
    })}

    <h3 style={{ margin: '16px 0 8px' }}>Journal des interventions</h3>
    {js.length === 0 && <div className="card muted">Aucune intervention validée pour le moment.</div>}
    {meses.map(([k, lista], idx) => {
      const rv = rvs.find(r => r.mes.slice(0, 7) === k); const [yy, mm] = k.split('-').map(Number);
      const open = abierto === k || (abierto === '' && idx === 0);
      const h = lista.reduce((s, j) => s + Number(j.horas), 0);
      return (<div className="card" key={k}>
        <div className="row" style={{ justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setAbierto(open ? '_' : k)}>
          <b>{open ? '▾' : '▸'} {periodoFr(yy, mm)}</b><span className="muted">{lista.length} intervention{lista.length > 1 ? 's' : ''} · {nf(h)} h</span>
        </div>
        {rv && <div className="row" style={{ marginTop: 6, justifyContent: 'space-between' }}>
          <span>📄 Relevé d'heures — validé le {fechaCorta(rv.publicado_en.slice(0, 10))}</span>
          <button className="btn" onClick={() => setVerRv(rv)}>Ouvrir / PDF</button>
        </div>}
        {open && <div style={{ overflowX: 'auto', marginTop: 8 }}><table>
          <thead><tr><th>Date</th><th>Prestation</th><th>Chantier</th><th>Personnes</th><th>Heures</th><th>Réalisé</th></tr></thead>
          <tbody>{lista.map((j, i) => (<tr key={i}>
            <td>{fmtDate(j.fecha)}</td><td>{j.servicio}</td><td>{j.proyecto || '—'}</td><td>{j.personas}</td><td>{nf(j.horas)} h</td>
            <td>{j.cantidad != null ? `${nf(j.cantidad)} ${UN[j.unidad] || j.unidad || ''}` : '—'}</td></tr>))}</tbody>
        </table></div>}
      </div>);
    })}
    <p className="muted" style={{ marginTop: 12 }}>Une question ? contact@bassoviti.com · 06 38 73 39 50</p>
  </>);
}
export default function Portal() { return <Shell roles={['cliente']}>{() => <Contenido />}</Shell>; }
