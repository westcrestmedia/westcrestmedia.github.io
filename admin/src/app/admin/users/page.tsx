import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatNumber, timeAgo, initials } from '@/lib/utils'
import { setUserRole, setUserStatus, deleteUser, type UserRowData } from './actions'

export const metadata: Metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 25

export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string; ok?: string; err?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const roleFilter = sp.role ?? 'all'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const me = await requireAdmin()

  const admin = createAdminClient()
  let query = admin
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_banned, created_at', { count: 'exact' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .order('created_at', { ascending: false })

  if (roleFilter === 'admin' || roleFilter === 'moderator' || roleFilter === 'user') {
    query = query.eq('role', roleFilter)
  }
  if (q) {
    query = query.or(`email.ilike.*${q}*,full_name.ilike.*${q}*`)
  }

  const { data, count } = await query

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const flashOk = sp.ok ?? null
  const flashErr = sp.err ?? null
  const users = (data ?? []) as UserRowData[]

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">User Management</div>
        <div className="toolbar">
          {flashOk && <span className="alert success" style={{ margin: 0 }}>✓ {flashOk}</span>}
          {flashErr && <span className="alert error" style={{ margin: 0 }}>✕ {flashErr}</span>}
          <form method="get" className="search-bar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            <input type="text" name="q" defaultValue={q} placeholder="Search name or email…" />
          </form>
          <span className="pg-info">{formatNumber(count ?? 0)} users</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.id} u={u} isSelf={u.id === me.id} />
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👤</div>
          <div className="empty-title">No users found</div>
          <div className="empty-desc">Try a different search.</div>
        </div>
      )}

      <div className="pagination">
        <span className="pg-info">
          Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count ?? 0)} of {formatNumber(count ?? 0)}
        </span>
        <div className="pg-controls">
          {page > 1 && (
            <Link className="btn" href={`/admin/users?page=${page - 1}&q=${encodeURIComponent(q)}&role=${roleFilter}`}>← Prev</Link>
          )}
          <span className="pg-info" style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="btn" href={`/admin/users?page=${page + 1}&q=${encodeURIComponent(q)}&role=${roleFilter}`}>Next →</Link>
          )}
        </div>
      </div>
    </div>
  )
}

function UserRow({ u, isSelf }: { u: UserRowData; isSelf: boolean }) {
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar">{initials(u.full_name || u.email)}</div>
          <div>
            <div>{u.full_name || '—'}{isSelf ? <span className="pill blue" style={{ marginLeft: 6 }}>you</span> : null}</div>
            <div className="cell-muted" style={{ fontSize: 12 }}>{u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <form action={setUserRole} style={{ display: 'inline-flex' }}>
          <input type="hidden" name="userId" value={u.id} />
          <select name="role" defaultValue={u.role} className="btn" style={{ padding: '3px 7px', fontSize: 12 }} onChange={(e) => {
            const form = e.target.form
            if (form) form.requestSubmit()
          }}>
            <option value="user">user</option>
            <option value="moderator">moderator</option>
            <option value="admin">admin</option>
          </select>
        </form>
      </td>
      <td>
        {u.is_banned
          ? <span className="pill red">banned</span>
          : <span className="pill green">active</span>}
      </td>
      <td className="cell-muted">{timeAgo(u.created_at)}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <form action={setUserStatus} style={{ display: 'inline-flex', marginRight: 6 }}>
          <input type="hidden" name="userId" value={u.id} />
          <input type="hidden" name="banned" value={u.is_banned ? '0' : '1'} />
          <button className="btn" type="submit">{u.is_banned ? 'Unban' : 'Ban'}</button>
        </form>
        <form action={deleteUser} style={{ display: 'inline-flex' }} onSubmit={(e) => {
          if (isSelf) { e.preventDefault(); return }
          if (!confirm(`Permanently delete ${u.email || 'this user'}? This cannot be undone.`)) e.preventDefault()
        }}>
          <input type="hidden" name="userId" value={u.id} />
          <button className="btn btn-danger-solid" type="submit" disabled={isSelf}>Delete</button>
        </form>
      </td>
    </tr>
  )
}