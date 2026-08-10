'use server'

import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameSiteOrigin } from '@/lib/security'
import { logAudit } from '@/lib/audit'

export async function approveReview(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await requireStaff()
  const id = String(formData.get('reviewId'))
  const adm = createAdminClient()
  await adm.from('reviews').update({ is_approved: true }).eq('id', id)
  await logAudit({
    action: 'review.approve',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'review',
    targetId: id
  })
  redirect('/admin/reviews?status=pending&ok=approved')
}

export async function unapproveReview(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await requireStaff()
  const id = String(formData.get('reviewId'))
  const adm = createAdminClient()
  await adm.from('reviews').update({ is_approved: false }).eq('id', id)
  await logAudit({
    action: 'review.unapprove',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'review',
    targetId: id
  })
  redirect('/admin/reviews?status=approved&ok=unapproved')
}

export async function deleteReview(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const staff = await requireStaff()
  const id = String(formData.get('reviewId'))
  const adm = createAdminClient()
  await adm.from('reviews').delete().eq('id', id)
  await logAudit({
    action: 'review.delete',
    actorId: staff.id,
    actorEmail: staff.email,
    targetType: 'review',
    targetId: id
  })
  redirect('/admin/reviews?status=all&ok=deleted')
}