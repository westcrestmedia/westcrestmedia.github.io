'use client'

import { useState } from 'react'
import { createContent, updateContent, deleteContent, type ContentItem } from './actions'

const TYPE_LABELS: Record<string, string> = { blog: 'Blog', page: 'Page', tool: 'Tool' }

export function ContentManager({ items }: { items: ContentItem[] }) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showNew, setShowNew] = useState(false)

  const editing = items.find((i) => i.id === editingId) ?? null

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Content Library</div>
        <button className="btn btn-primary" onClick={() => { setShowNew((v) => !v); setEditingId(null) }}>
          {showNew ? 'Close' : '+ New content'}
        </button>
      </div>

      {showNew && (
        <form action={createContent} className="panel-body" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <div className="form-grid">
            <div className="field">
              <label>Type</label>
              <select name="type" defaultValue="blog">
                <option value="blog">Blog post</option>
                <option value="page">Page</option>
                <option value="tool">Tool</option>
              </select>
            </div>
            <div className="field">
              <label>Slug (url — lowercase, hyphens)</label>
              <input name="slug" placeholder="my-new-blog-post" required />
            </div>
            <div className="field col-span-2">
              <label>Title</label>
              <input name="title" placeholder="Post title" required />
            </div>
            <div className="field col-span-2">
              <label>Description</label>
              <input name="description" placeholder="Short summary shown in listings" />
            </div>
            <div className="field col-span-2">
              <label>Body (markdown / plain text)</label>
              <textarea name="body" rows={5} placeholder="Write content…" />
            </div>
            <div className="field">
              <label className="checkbox" style={{ textTransform: 'none', fontFamily: 'inherit' }}>
                <input type="checkbox" name="published" value="1" defaultChecked /> Published
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Create</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Slug</th><th>Status</th><th>Updated</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <div>{i.title}</div>
                  {i.description && <div className="cell-muted" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</div>}
                </td>
                <td><span className="pill gray">{TYPE_LABELS[i.type] ?? i.type}</span></td>
                <td className="cell-muted" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>/{i.slug}</td>
                <td>
                  {i.published
                    ? <span className="pill green">published</span>
                    : <span className="pill amber">draft</span>}
                </td>
                <td className="cell-muted">{i.updated_at ? new Date(i.updated_at).toLocaleDateString() : '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn" type="button" style={{ marginRight: 6 }} onClick={() => { setEditingId(i.id); setShowNew(false) }}>
                    Edit
                  </button>
                  <form action={deleteContent} style={{ display: 'inline-flex' }} onSubmit={(e) => { if (!confirm('Delete this item?')) e.preventDefault() }}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn btn-danger-solid" type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !showNew && (
        <div className="empty">
          <div className="empty-icon">📄</div>
          <div className="empty-title">No content yet</div>
          <div className="empty-desc">Create your first blog post, page or tool entry.</div>
        </div>
      )}

      {editing && (
        <form action={updateContent} className="panel-body" style={{ borderTop: '1px solid var(--border-soft)' }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>Editing: {editing.title}</div>
          <input type="hidden" name="id" value={editing.id} />
          <div className="form-grid">
            <div className="field col-span-2">
              <label>Title</label>
              <input name="title" defaultValue={editing.title} required />
            </div>
            <div className="field col-span-2">
              <label>Description</label>
              <input name="description" defaultValue={editing.description ?? ''} />
            </div>
            <div className="field col-span-2">
              <label>Body</label>
              <textarea name="body" rows={8} defaultValue={editing.body ?? ''} />
            </div>
            <div className="field col-span-2">
              <label>Meta title (SEO)</label>
              <input name="meta_title" defaultValue={editing.meta_title ?? ''} maxLength={160} />
            </div>
            <div className="field col-span-2">
              <label>Meta description (SEO)</label>
              <textarea name="meta_description" rows={2} defaultValue={editing.meta_description ?? ''} maxLength={320} />
            </div>
            <div className="field">
              <label className="checkbox" style={{ textTransform: 'none', fontFamily: 'inherit' }}>
                <input type="checkbox" name="published" value="1" defaultChecked={editing.published} /> Published
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Save changes</button>
            <button className="btn" type="button" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}