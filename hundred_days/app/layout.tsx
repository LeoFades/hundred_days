import type { Metadata } from 'next'
import { Pixelify_Sans } from 'next/font/google'
import './globals.css'

const pixel = Pixelify_Sans({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-pixel',
})

export const metadata: Metadata = {
  title: '100 Days',
  description: 'Check in every day for 100 days.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={pixel.variable}>
      <body>{children}</body>
    </html>
  )
}
