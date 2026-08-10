import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = { title: 'Audit Log' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 40

type Log = {
  id: string
  actor_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: unknown
  ip: string | null
  created_at: string
}

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; action?: string }>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const actionFilter = sp.action ?? ''

  const admin = createAdminClient()
  let base = admin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (actionFilter) base = base.ilike('action', `%${actionFilter}%`)

  // pagination
  const { data, count } = await base.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  const logs = (data ?? []) as Log[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const actionColors: Record<string, string> = {
    'auth.login': 'blue',
    'auth.login.oauth': 'blue',
    'auth.logout': 'gray',
    'admin.bootstrap': 'gold',
    'user.set_role': 'gold',
    'user.ban': 'red',
    'user.unban': 'green',
    'user.delete': 'red',
    'review.approve': 'green',
    'review.unapprove': 'amber',
    'review.delete': 'red',
    'content.create': 'green',
    'content.update': 'blue',
    'content.delete': 'red',
    'settings.update': 'gold'
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Security Audit Log</div>
        <form className="toolbar">
          <span className="pg-info">{count ?? 0} events</span>
          <input type="text" name="action" defaultValue={actionFilter} placeholder="Filter by action…" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 10px' }} />
          <button className="btn" type="submit">Apply</button>
        </form>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>ID</th><th>Action</th><th>Actor</th><th>Target</th><th>IP</th><th>When</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="cell-muted" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{l.id}</td>
                <td><span className={`pill ${actionColors[l.action] ?? 'gray'}`}>{l.action}</span></td>
                <td>{l.actor_email || <em className="cell-muted">system</em>}</td>
                <td className="cell-muted" style={{ fontSize: 12 }}>
                  {l.target_type ? `${l.target_type}:${l.target_id ?? ''}` : '—'}
                </td>
                <td className="cell-muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{l.ip || '—'}</td>
                <td className="cell-muted" title={l.created_at ? new Date(l.created_at).toLocaleString() : ''}>{timeShort(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🛡️</div>
          <div className="empty-title">No events</div>
          <div className="empty-desc">Admin actions will be logged here.</div>
        </div>
      )}

      <div className="pagination">
        <span className="pg-info">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count ?? 0)} of {count ?? 0}</span>
        <div className="pg-controls">
          {page > 1 ? (
            <Link className="btn" href={`/admin/audit?page=${page - 1}&action=${encodeURIComponent(actionFilter)}`}>← Prev</Link>
          ) : <span />}
          <span className="pg-info" style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="btn" href={`/admin/audit?page=${page + 1}&action=${encodeURIComponent(actionFilter)}`}>Next →</Link>
          )}
        </div>
      </div>
    </div>
  )
}

function timeShort(dt: string) {
  return timeAgoCompat(dt)
}

function timeAgoCompat(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return `${Math.floor(d / 30)}mo`
}