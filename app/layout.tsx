import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI School OS',
  description: 'The ultimate AI-powered academic command center. Generate study guides natively, track assignments, and master your classes from one dashboard.',
  metadataBase: new URL('https://aischoolos.com'), // Recommended for absolute OG image paths, replace domain later if needed
  openGraph: {
    title: 'AI School OS | Academic Command Center',
    description: 'The ultimate AI-powered academic command center. Generate study guides natively, track assignments, and master your classes.',
    siteName: 'AI School OS',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI School OS',
    description: 'The ultimate AI-powered academic command center. Natively generate study guides and track your entire semester.',
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  )
}
