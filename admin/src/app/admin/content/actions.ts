'use server'

import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameSiteOrigin, sanitizeText } from '@/lib/security'
import { logAudit } from '@/lib/audit'

export type ContentItem = {
  id: number
  type: string
  slug: string
  title: string
  body: string | null
  description: string | null
  image: string | null
  published: boolean
  author_id: string | null
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}

const TYPES = ['blog', 'page', 'tool']
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function getStaff() {
  const staff = await requireStaff()
  return staff
}

export async function createContent(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await getStaff()

  const type = String(formData.get('type') || 'blog')
  const rawSlug = sanitizeText(formData.get('slug'), 120).toLowerCase()
  const title = sanitizeText(formData.get('title'), 200)
  const description = sanitizeText(formData.get('description'), 500)
  const body = sanitizeText(formData.get('body'), 100000)
  const published = formData.get('published') === '1'

  if (!TYPES.includes(type)) throw new Error('Invalid content type')
  if (!SLUG_RE.test(rawSlug)) redirect('/admin/content?err=invalid-slug')
  if (!title.trim()) redirect('/admin/content?err=missing-title')

  const adm = createAdminClient()
  const { error } = await adm.from('content').insert({
    type,
    slug: rawSlug,
    title,
    description: description || null,
    body: body || null,
    published,
    author_id: staff.id
  })

  if (error) redirect(`/admin/content?err=${encodeURIComponent('create-failed')}`)

  await logAudit({
    action: 'content.create',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'content',
    targetId: rawSlug,
    metadata: { type, slug: rawSlug, title }
  })
  redirect('/admin/content?ok=created')
}

export async function updateContent(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await getStaff()

  const id = Number(formData.get('id'))
  const title = sanitizeText(formData.get('title'), 200)
  const description = sanitizeText(formData.get('description'), 500)
  const body = sanitizeText(formData.get('body'), 100000)
  const published = formData.get('published') === '1'
  const metaTitle = sanitizeText(formData.get('meta_title'), 160)
  const metaDescription = sanitizeText(formData.get('meta_description'), 320)

  if (Number.isNaN(id)) throw new Error('Invalid id')

  const adm = createAdminClient()
  const { data: before } = await adm.from('content').select('slug, type, title').eq('id', id).maybeSingle()

  const { error } = await adm
    .from('content')
    .update({
      title,
      description: description || null,
      body: body || null,
      published,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) redirect('/admin/content?err=update-failed')

  await logAudit({
    action: 'content.update',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'content',
    targetId: String(before?.slug || id),
    metadata: { slug: before?.slug, title }
  })

  redirect('/admin/content?ok=updated')
}

export async function deleteContent(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await getStaff()
  const id = Number(formData.get('id'))

  const adm = createAdminClient()
  const { data: before } = await adm.from('content').select('slug, type').eq('id', id).maybeSingle()
  await adm.from('content').delete().eq('id', id)

  await logAudit({
    action: 'content.delete',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'content',
    targetId: String(before?.slug || id),
    metadata: { slug: before?.slug, type: before?.type }
  })

  redirect('/admin/content?ok=deleted')
}