import './globals.css';
const LOGO = 'https://i.postimg.cc/bvDHmp47/WhatsApp-Image-2026-05-14-at-17-24-20-(6).jpg';
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = { title: 'Basso Services Viticoles', description: 'ERP Basso', manifest: BASE + '/manifest.webmanifest', icons: { icon: LOGO, shortcut: LOGO, apple: LOGO }, appleWebApp: { capable: true, title: 'Basso ERP', statusBarStyle: 'default' as const } };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#8B1A2B' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
