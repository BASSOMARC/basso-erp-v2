'use client';
import { LOGO_RELEVE } from '@/lib/logo-releve';

/* Datos de la empresa para el documento (se imprime siempre en francés) */
export const EMPRESA = {
  nombre: 'BASSO SERVICES VITICOLES', forma: 'SARL',
  direccion: '189 avenue du Maréchal Foch, 33500 Libourne',
  siret: '908 479 975 00041', rcs: 'R.C.S. Libourne 908 479 975', tva: 'FR91908479975',
  email: 'contact@bassoviti.com', tel: '06 38 73 39 50',
};
export const MESES_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nf = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
export const hh = (n: number) => nf(n) + ' h';
export const fechaFr = (iso: string) => { const d = new Date(iso + 'T12:00:00'); const dd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''); return dd + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); };
export const fechaCorta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
export const periodoFr = (y: number, m: number) => MESES_FR[m - 1].charAt(0).toUpperCase() + MESES_FR[m - 1].slice(1) + ' ' + y;

export type Datos = { lineas: { fecha: string; prest: string; proy: string; nb: number; total: number; detalle: string; hayBorrador?: boolean }[]; totalH: number; jours: number; hayBorrador?: boolean };

export default function ReleveDoc({ cliente, periodo, editado, d }: { cliente: string; periodo: string; editado: string; d: Datos }) {
  return (<div className="releve">
    <div className="rv-head">
      <img src={LOGO_RELEVE} alt="Basso Services Viticoles" className="rv-logo" />
      <div className="rv-emp">
        <b>{EMPRESA.forma} {EMPRESA.nombre}</b><br />{EMPRESA.direccion}<br />
        SIRET {EMPRESA.siret} · {EMPRESA.rcs}<br />N° TVA intracommunautaire {EMPRESA.tva}<br />{EMPRESA.email} · Tél. {EMPRESA.tel}
      </div>
    </div>
    <h1 className="rv-tit">RELEVÉ D'HEURES</h1>
    <div className="rv-meta"><div><span>Client</span><b>{cliente}</b></div><div><span>Période</span><b>{periodo}</b></div><div><span>Édité le</span><b>{editado}</b></div></div>
    {d.hayBorrador && <div className="rv-borr">BROUILLON — contient des journées non validées. Ne pas envoyer au client.</div>}
    {d.lineas.length === 0 ? <div className="rv-vacio">Aucune journée validée pour cette période.</div> : <>
      <table className="rv-tab">
        <thead><tr><th>Date</th><th>Prestation</th><th className="c">Nb ouvriers</th><th className="c">Heures par ouvrier</th><th className="r">Total du jour</th></tr></thead>
        <tbody>{d.lineas.map((r, i) => <tr key={i}><td>{fechaFr(r.fecha)}</td><td>{r.prest}{r.proy && <div className="rv-sub">{r.proy}</div>}</td><td className="c">{r.nb}</td><td className="c">{r.detalle}</td><td className="r"><b>{hh(r.total)}</b></td></tr>)}</tbody>
        <tfoot><tr><td colSpan={4}>TOTAL GÉNÉRAL DES HEURES — {d.jours} jour{d.jours > 1 ? 's' : ''} d'intervention</td><td className="r">{hh(d.totalH)}</td></tr></tfoot>
      </table>
      <div className="rv-firmas"><div><span>Basso Services Viticoles</span></div><div><span>Le client — bon pour accord (date, signature, cachet)</span></div></div>
    </>}
  </div>);
}
