import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth'
import { AdminNav } from './admin-nav'
import { AdminLogout } from './admin-logout'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/images/w_logo.svg" alt="Westcrest" onError={undefined} />
          <div>
            <div className="brand-text">Westcrest</div>
            <div className="brand-sub">Admin Panel</div>
          </div>
        </div>

        <Suspense fallback={null}>
          <AdminNav role={user.role} />
        </Suspense>

        <div className="sidebar-footer">
          <div className="avatar">{user.fullName?.charAt(0) || 'A'}</div>
          <div className="sf-info">
            <div className="sf-name">{user.fullName || 'Admin'}</div>
            <div className="sf-email">{user.email}</div>
          </div>
          <AdminLogout />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>Westcrest Admin</h1>
            <div className="pcrumbs">Signed in as {user.role}</div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}