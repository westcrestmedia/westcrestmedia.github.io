import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatNumber, timeAgo, initials } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

function truncate(str: string | null | undefined, max = 60): string {
  const s = str ?? ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export default async function DashboardPage() {
  const admin = createAdminClient()

  const [
    profiles,
    reviews,
    pending,
    downloads,
    bookmarks,
    recentUsers,
    recentActivity,
    pendingRows
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('reviews').select('id', { count: 'exact', head: true }),
    admin.from('reviews').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    admin.from('downloads').select('id', { count: 'exact', head: true }),
    admin.from('bookmarks').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id, full_name, email, role, created_at').order('created_at', { ascending: false }).limit(6),
    admin.from('audit_logs').select('actor_email, action, created_at').order('created_at', { ascending: false }).limit(8),
    admin.from('reviews').select('id, tool_slug, tool_name, user_name, review_text, rating, created_at').eq('is_approved', false).order('created_at', { ascending: false }).limit(6)
  ])

  const stats = [
    { label: 'Total Users', value: profiles?.count ?? 0, foot: 'registered accounts' },
    { label: 'Total Reviews', value: reviews?.count ?? 0, foot: 'all submitted' },
    { label: 'Pending Reviews', value: pending?.count ?? 0, foot: 'awaiting moderation' },
    { label: 'Total Downloads', value: downloads?.count ?? 0, foot: 'tool exports' },
    { label: 'Bookmarks', value: bookmarks?.count ?? 0, foot: 'saved by creators' }
  ]

  return (
    <>
      <div className="stats">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{formatNumber(s.value)}</div>
            <div className="stat-foot">{s.foot}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Latest Sign-ups</div>
          <Link href="/admin/users" className="btn">View all</Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>User</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {(recentUsers?.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">{initials(u.full_name || u.email)}</div>
                      <div>
                        <div>{u.full_name || '—'}</div>
                        <div className="cell-muted" style={{ fontSize: 12 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${u.role === 'admin' ? 'gold' : u.role === 'moderator' ? 'blue' : 'gray'}`}>{u.role}</span>
                  </td>
                  <td className="cell-muted">{timeAgo(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Awaiting Moderation</div>
          <Link href="/admin/reviews" className="btn">Moderate</Link>
        </div>
        {pendingRows?.data && pendingRows.data.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Review</th><th>Tool</th><th>Rating</th><th>When</th></tr></thead>
              <tbody>
                {pendingRows.data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div>{r.user_name || 'Anonymous'}</div>
                      <div className="cell-muted" style={{ fontSize: 12, maxWidth: 300 }}>{truncate(r.review_text, 60)}</div>
                    </td>
                    <td>{r.tool_name || r.tool_slug}</td>
                    <td><span className="pill amber">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></td>
                    <td className="cell-muted">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <div className="empty-desc">No reviews waiting for approval.</div>
          </div>
        )}
      </div>
    </>
  )
}