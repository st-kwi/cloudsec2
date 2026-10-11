import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import './globals.css'

export const metadata: Metadata = { title: 'DNS69 — ทายผลฟุตบอลกีฬาสี', description: 'ทายผลฟุตบอลกีฬาสีระหว่างคณะ' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Header />
        <main className="wrap">{children}</main>
      </body>
    </html>
  )
}
