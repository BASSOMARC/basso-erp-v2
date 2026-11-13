import './globals.css';
const LOGO = 'https://i.postimg.cc/bvDHmp47/WhatsApp-Image-2026-05-14-at-17-24-20-(6).jpg';
export const metadata = { title: 'Basso Services Viticoles', description: 'ERP Basso', icons: { icon: LOGO, shortcut: LOGO, apple: LOGO } };
export const viewport = { width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
