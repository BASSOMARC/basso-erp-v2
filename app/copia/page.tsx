'use client';
import { useState } from 'react';
import Shell from '@/lib/Shell';
import { sb, todas } from '@/lib/supabase';

const TABLAS: [string, string][] = [
  ['clientes', 'id'], ['servicios', 'id'], ['proyectos', 'id'], ['tareas', 'id'], ['trabajadores', 'id'], ['perfiles', 'user_id'],
  ['jornadas', 'id'], ['jornada_trabajador', 'id'], ['jornada_cantidad', 'id'], ['incidencias', 'id'],
  ['tarifas', 'id'], ['coste_hora', 'id'], ['prima_porteur', 'id'], ['campanas', 'id'], ['ventas_uva', 'id'],
  ['subcontratistas', 'id'], ['subcontratos', 'id'], ['subcontrato_precio', 'id'], ['trabajos_previstos', 'id'],
  ['org_citas', 'id'], ['org_tareas', 'id'], ['org_meses', 'mes'], ['historial_cambios', 'id'],
];
const CLAVE_COPIA = 'ultima_copia';

function Contenido() {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null); const [prog, setProg] = useState('');
  const [ult, setUlt] = useState<string>(() => { try { return localStorage.getItem(CLAVE_COPIA) || ''; } catch { return ''; } });
  async function copiar() {
    setBusy(true); setMsg(null); const out: Record<string, any[]> = {}; const fallos: string[] = [];
    try {
      for (const [t, k] of TABLAS) {
        setProg(t + '…');
        try { out[t] = await todas((a, b) => sb.from(t).select('*').order(k).range(a, b)); } catch (e: any) { fallos.push(t + ': ' + e.message); }
      }
      if (fallos.length) { setMsg({ t: 'err', m: 'No se pudo copiar todo, no se descarga: ' + fallos.join(' · ') }); setBusy(false); setProg(''); return; }
      const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const cuerpo = JSON.stringify({ app: 'basso-erp-v2', generado: new Date().toISOString(), filas: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), tablas: out });
      const url = URL.createObjectURL(new Blob([cuerpo], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `copia-basso-erp-${hoy}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      try { localStorage.setItem(CLAVE_COPIA, hoy); } catch {} setUlt(hoy);
      const total = Object.values(out).reduce((s, v) => s + v.length, 0);
      setMsg({ t: 'ok', m: `Copia descargada ✔ ${TABLAS.length} tablas, ${total} filas. Guárdala en un sitio seguro fuera del ERP (por ejemplo, tu Drive privado).` });
    } catch (e: any) { setMsg({ t: 'err', m: e.message }); }
    setBusy(false); setProg('');
  }
  return (<>
    <h2 style={{ marginBottom: 4 }}>Copia de seguridad</h2>
    <div className="muted" style={{ marginBottom: 10 }}>Descarga todos los datos del ERP en un solo archivo. Hazla al menos una vez por semana y guárdala fuera del ERP. El archivo contiene datos personales y costes: no lo compartas ni lo subas a GitHub.</div>
    <div className="card">
      <div style={{ marginBottom: 8 }}>Última copia hecha desde este navegador: <b>{ult || 'ninguna todavía'}</b></div>
      <button className="btn btn-g btn-lg" disabled={busy} onClick={copiar}>{busy ? 'Copiando ' + prog : 'Descargar copia completa'}</button>
      {msg && <div className={'msg ' + msg.t} style={{ marginTop: 10 }}>{msg.m}</div>}
    </div>
  </>);
}
export default function Page() { return <Shell roles={['admin']}>{() => <Contenido />}</Shell>; }
