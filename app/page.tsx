'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
const HOME: Record<string, string> = { admin: '/dashboard', secretaria: '/dashboard', jefe: '/fichaje', cliente: '/portal' };
export default function Home() {
  const router = useRouter();
  useEffect(() => { (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return router.replace('/login');
    const { data } = await sb.from('perfiles').select('rol,es_jefe').eq('user_id', session.user.id).maybeSingle();
    router.replace(data ? (data.rol === 'admin' && data.es_jefe && window.innerWidth <= 640 ? '/fichaje' : HOME[data.rol]) : '/login');
  })(); }, []);
  return <div className="content muted">Cargando…</div>;
}
