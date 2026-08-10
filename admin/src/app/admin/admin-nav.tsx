'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_STAFF, NAV_ADMIN } from './nav-data'

const ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l1.9 3.9 4.4.6-3.2 3 .8 4.3L8 11.2l-3.9 2.1.8-4.3-3.2-3 4.4-.6L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  ),
  doc: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 1.5h7l3 3v10h-10z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 13.5c0-2.5 1-4.2 4.5-4.2s4.5 1.7 4.5 4.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="11.5" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.3"/><path d="M11 9.5c2 0 3.5 1.4 3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l14 2v5.2c0 3.4-2.2 5.6-5 6.8-2.8-1.2-5-3.4-5-6.8v-5.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l1.6 1.6 3-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1.6l.7 1.9 1.8.5 1.7-1 1.3 1.3-1 1.7.5 1.8 1.9.7v1.6l-1.9.7-.5 1.8 1 1.7-1.3 1.3-1.7-1-1.8.5-.7 1.9H7.3l-.7-1.9-1.8-.5-1.7 1-1.3-1.3 1-1.7-.5-1.8-1.9-.7V7.3l1.9-.7.5-1.8-1-1.7 1.3-1.3 1.7 1 1.8-.5.7-1.9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
  )
}

export function AdminNav({ role }: { role: string }) {
  const pathname = usePathname()
  const adminOnly = role === 'admin' ? NAV_ADMIN : []

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const renderItems = (items: typeof NAV_STAFF) =>
    items.map((item) => {
      const active = isActive(item.href)
      return (
        <Link key={item.href} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
          {ICONS[item.icon]}
          <span>{item.label}</span>
        </Link>
      )
    })

  return (
    <>
      <div className="sidebar-label">Manage</div>
      {renderItems(NAV_STAFF)}
      {adminOnly.length > 0 && <div className="sidebar-label">Administration</div>}
      {renderItems(adminOnly)}
    </>
  )
}