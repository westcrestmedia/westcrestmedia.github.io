import type { Metadata } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Westcrest Admin',
    template: '%s · Westcrest Admin'
  },
  robots: { index: false, follow: false },
  applicationName: 'Westcrest Media Admin'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}