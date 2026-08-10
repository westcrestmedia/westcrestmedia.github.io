import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeAgo, initials } from '@/lib/utils'
import { approveReview, unapproveReview, deleteReview } from './actions'

export const metadata: Metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_SIZE = 20

type Review = {
  id: string
  tool_slug: string
  tool_name: string | null
  rating: number
  review_text: string | null
  user_id: string
  user_name: string | null
  user_avatar: string | null
  is_approved: boolean
  created_at: string
}

export default async function ReviewsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; page?: string; tool?: string; ok?: string }>
}) {
  const sp = await searchParams
  const status = sp.status ?? 'pending'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const tool = (sp.tool ?? '').trim()

  const admin = createAdminClient()
  let query = admin
    .from('reviews')
    .select('*', { count: 'exact' })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .order('created_at', { ascending: false })

  if (status === 'pending') query = query.eq('is_approved', false)
  else if (status === 'approved') query = query.eq('is_approved', true)
  if (tool) query = query.eq('tool_slug', tool)

  const { data, count } = await query
  const reviews = (data ?? []) as Review[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const tabs: { key: string; label: string; href: string }[] = [
    { key: 'pending', label: 'Pending', href: '/admin/reviews?status=pending' },
    { key: 'approved', label: 'Approved', href: '/admin/reviews?status=approved' },
    { key: 'all', label: 'All', href: '/admin/reviews?status=all' }
  ]

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Review Moderation</div>
        <div className="toolbar">
          {sp.ok && <span className="alert success" style={{ margin: 0 }}>✓ {sp.ok}</span>}
          <div className="toolbar">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className="btn"
                style={status === t.key ? { background: 'var(--gold)', color: '#0a0a0a', borderColor: 'var(--gold)' } : {}}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <span className="pg-info">{count ?? 0} shown</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Author</th><th>Tool</th><th>Rating</th><th>Review</th><th>Status</th><th>When</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar">{r.user_avatar ? <img src={r.user_avatar} alt="" /> : initials(r.user_name)}</div>
                    <span>{r.user_name || 'Anonymous'}</span>
                  </div>
                </td>
                <td><span className="pill gray">{r.tool_name || r.tool_slug}</span></td>
                <td><span className="pill amber">{'★'.repeat(r.rating)}</span></td>
                <td style={{ maxWidth: 320 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.review_text || <em className="cell-muted">(no text)</em>}</div>
                </td>
                <td>
                  {r.is_approved
                    ? <span className="pill green">approved</span>
                    : <span className="pill amber">pending</span>}
                </td>
                <td className="cell-muted">{timeAgo(r.created_at)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {!r.is_approved ? (
                    <form action={approveReview} style={{ display: 'inline-flex', marginRight: 6 }}>
                      <input type="hidden" name="reviewId" value={r.id} />
                      <button className="btn btn-success" type="submit">Approve</button>
                    </form>
                  ) : (
                    <form action={unapproveReview} style={{ display: 'inline-flex', marginRight: 6 }}>
                      <input type="hidden" name="reviewId" value={r.id} />
                      <button className="btn" type="submit">Unapprove</button>
                    </form>
                  )}
                  <form action={deleteReview} style={{ display: 'inline-flex' }} onSubmit={(e) => { if (!confirm('Delete this review?')) e.preventDefault() }}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="btn btn-danger-solid" type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviews.length === 0 && (
        <div className="empty">
          <div className="empty-icon">⭐</div>
          <div className="empty-title">No reviews here</div>
          <div className="empty-desc">{status === 'pending' ? 'No reviews waiting for moderation. Nice!' : 'Nothing to show for this filter.'}</div>
        </div>
      )}

      <div className="pagination">
        <span className="pg-info">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count ?? 0)} of {count ?? 0}</span>
        <div className="pg-controls">
          {page > 1 && <Link className="btn" href={`/admin/reviews?status=${status}&page=${page - 1}&tool=${tool}`}>← Prev</Link>}
          <span className="pg-info" style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
          {page < totalPages && <Link className="btn" href={`/admin/reviews?status=${status}&page=${page + 1}&tool=${tool}`}>Next →</Link>}
        </div>
      </div>
    </div>
  )
}