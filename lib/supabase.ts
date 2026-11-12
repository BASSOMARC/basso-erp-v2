import { createClient } from '@supabase/supabase-js';
export const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: true, autoRefreshToken: true },
});
export type Perfil = { user_id: string; rol: 'admin'|'secretaria'|'jefe'|'cliente'; nombre: string; cliente_id: string|null };
export const hoy = () => new Date().toISOString().slice(0, 10);
// Trae todas las filas de una consulta (la API corta en 1000 por petición)
export async function todas(build: (a: number, b: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await build(i, i + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
