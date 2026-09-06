import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ClipSync — Instant Clipboard Sync Between Devices',
  description:
    'Sync your clipboard between any two devices instantly. No login, no app, no setup — just open and paste.',
  keywords: 'clipboard sync, copy paste between devices, no login clipboard, browser clipboard sync',
  authors: [{ name: 'ClipSync' }],
  openGraph: {
    title: 'ClipSync — Instant Clipboard Sync',
    description: 'Copy on one device, paste on another. No login. No install.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EFE9' },
    { media: '(prefers-color-scheme: dark)',  color: '#111009' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
