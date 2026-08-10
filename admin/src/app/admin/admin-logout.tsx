'use client'

import { useTransition } from 'react'
import { logout } from '@/app/login/actions'

export function AdminLogout() {
  const [pending, start] = useTransition()
  return (
    <button
      className="btn"
      style={{ padding: '6px 10px', flexShrink: 0 }}
      title="Sign out"
      disabled={pending}
      onClick={() => start(() => logout())}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  )
}