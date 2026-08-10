'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameSiteOrigin } from '@/lib/security'
import { logAudit } from '@/lib/audit'

export type UserRowData = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'user' | 'moderator' | 'admin'
  is_banned: boolean
  created_at: string
}
type UserActionsData = UserRowData

export async function setUserRole(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const admin = await requireAdmin()

  const userId = String(formData.get('userId'))
  const role = String(formData.get('role'))
  if (!['user', 'moderator', 'admin'].includes(role)) redirect('/admin/users?error=invalid_role')

  const adm = createAdminClient()
  await adm.from('profiles').update({ role: role as 'user' | 'moderator' | 'admin' }).eq('id', userId)

  await logAudit({
    action: 'user.set_role',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'profile',
    targetId: userId,
    metadata: { role }
  })
  redirect(`/admin/users?ok=role-updated`)
}

export async function setUserStatus(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const admin = await requireAdmin()

  const userId = String(formData.get('userId'))
  const banned = formData.get('banned') === '1'

  const adm = createAdminClient()
  await adm.from('profiles').update({ is_banned: banned }).eq('id', userId)

  if (banned) {
    // Banned user ka active session end karo via admin API
    try {
      await deleteAuthSessions(userId)
    } catch {}
  }

  await logAudit({
    action: banned ? 'user.ban' : 'user.unban',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'profile',
    targetId: userId
  })
  redirect(`/admin/users?ok=${banned ? 'banned' : 'unbanned'}`)
}

/** Permanently delete `user_id` (profile + auth.user + cascades). */
export async function deleteUser(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const admin = await requireAdmin()

  const userId = String(formData.get('userId'))
  if (userId === admin.id) {
    redirect('/admin/users?err=no-self-delete')
  }

  const adm = createAdminClient()
  // 1. profile delete (cascade from auth.user kabhi Opposite nahi hota isliye manually)
  await adm.from('profiles').delete().eq('id', userId)
  // 2. auth.user delete via Admin API (service role)
  await deleteAuthUser(userId)

  await logAudit({
    action: 'user.delete',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'profile',
    targetId: userId
  })
  redirect(`/admin/users?ok=deleted`)
}

async function deleteAuthUser(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  })
}

async function deleteAuthSessions(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  // get sessions
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}/sessions`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  })
  const json = await res.json().catch(() => [])
  const sessions = Array.isArray(json) ? json : []
  await Promise.all(
    sessions.map((s: { id: string }) =>
      fetch(`${url}/auth/v1/admin/users/${userId}/sessions/${s.id}`, {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
      })
    )
  )
}