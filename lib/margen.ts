import { sb, todas } from './supabase';

export type Jm = { id: string; fecha: string; estado: string; cliente: string; servicio: string; modalidad: string; nf: boolean; horas: number; personas: number; cantidad: number; unidad: string; coste: number; ingreso: number; sinTarifa: boolean };
const vig = (lista: any[], fecha: string) => lista.filter(x => x.desde <= fecha).sort((a, b) => b.desde.localeCompare(a.desde))[0];

/** Margen por jornada entre a (incl.) y b (excl.). Solo jornadas fichadas o validadas. Solo para administradores (costes y tarifas son admin). */
export async function cargarMargen(a: string, b: string): Promise<{ js: Jm[]; sinCoste: number; sinTarifa: number }> {
  const emb = 'tareas(modalidad,cliente_id,servicios(nombre),clientes(nombre,no_facturable))';
  const [lin, cant, coste, prima, tar] = await Promise.all([
    todas((x, z) => sb.from('jornada_trabajador').select(`trabajador_id,horas_normal,horas_extra,funcion,trabajadores(tipo),jornadas!inner(id,fecha,estado,${emb})`).is('borrado_en', null).eq('confirmado', true).eq('ausente', false).gte('jornadas.fecha', a).lt('jornadas.fecha', b).in('jornadas.estado', ['fichada', 'validada']).order('id').range(x, z)),
    todas((x, z) => sb.from('jornada_cantidad').select(`unidad,cantidad,jornadas!inner(id,fecha,estado,${emb})`).is('borrado_en', null).gte('jornadas.fecha', a).lt('jornadas.fecha', b).in('jornadas.estado', ['fichada', 'validada']).order('id').range(x, z)),
    sb.from('coste_hora').select('*'), sb.from('prima_porteur').select('*'),
    todas((x, z) => sb.from('tarifas').select('*').order('id').range(x, z)),
  ]);
  if (coste.error) throw coste.error; if (prima.error) throw prima.error;
  const precio = (cli: string, serv: string, uni: string, fecha: string) => {
    const c = (f: (t: any) => boolean) => vig(tar.filter((t: any) => t.unidad === uni && f(t)), fecha);
    return c(t => t.cliente_id === cli && t.servicio === serv) || c(t => t.cliente_id === cli && t.servicio === '*') || c(t => t.cliente_id === null && t.servicio === serv) || c(t => t.cliente_id === null && t.servicio === '*');
  };
  const M: Record<string, Jm> = {}; let sinCoste = 0; const primaVista = new Set<string>(); const personas: Record<string, Set<string>> = {};
  const get = (j: any): Jm => { const t = j.tareas; return (M[j.id] ||= { id: j.id, fecha: j.fecha, estado: j.estado, cliente: t?.clientes?.nombre || '—', servicio: t?.servicios?.nombre || 'Sin servicio', modalidad: t?.modalidad || 'hora', nf: !!t?.clientes?.no_facturable, horas: 0, personas: 0, cantidad: 0, unidad: '', coste: 0, ingreso: 0, sinTarifa: false }); };
  lin.forEach((r: any) => {
    const j = r.jornadas; const m = get(j); const h = Number(r.horas_normal) + Number(r.horas_extra);
    const ch = vig(coste.data!.filter((x: any) => x.tipo_trabajador === (r.trabajadores?.tipo || 'peon')), j.fecha); if (!ch) sinCoste++;
    m.horas += h; m.coste += h * Number(ch?.euros_hora || 0);
    (personas[j.id] ||= new Set()).add(r.trabajador_id);
    const kp = r.trabajador_id + j.fecha;
    if (r.funcion === 'porteur' && !primaVista.has(kp)) { primaVista.add(kp); m.coste += Number(vig(prima.data!, j.fecha)?.euros_dia || 0); }
  });
  Object.values(M).forEach(m => { m.personas = personas[m.id]?.size || 0; });
  const vistos = new Set<string>();
  cant.forEach((r: any) => {
    const j = r.jornadas; const m = get(j); const t = j.tareas;
    if (t?.modalidad !== 'cepa' && t?.modalidad !== 'kg') return;
    if (r.unidad !== (t.modalidad === 'cepa' ? 'cepas' : 'kg')) return;
    const k = j.id + r.unidad; if (vistos.has(k)) return; vistos.add(k);
    m.cantidad = Number(r.cantidad); m.unidad = r.unidad;
  });
  let sinTarifa = 0;
  Object.values(M).forEach(m => {
    if (m.nf) return;
    const j = lin.find((r: any) => r.jornadas.id === m.id)?.jornadas || cant.find((r: any) => r.jornadas.id === m.id)?.jornadas; const cli = j?.tareas?.cliente_id || '—';
    const uni = m.modalidad === 'cepa' || m.modalidad === 'kg' ? m.modalidad : 'hora';
    const p = precio(cli, m.servicio, uni, m.fecha);
    if (!p) { m.sinTarifa = true; sinTarifa++; return; }
    m.ingreso = (uni === 'hora' ? m.horas : m.cantidad) * Number(p.precio);
  });
  return { js: Object.values(M).sort((x, y) => y.fecha.localeCompare(x.fecha) || x.cliente.localeCompare(y.cliente)), sinCoste, sinTarifa };
}
