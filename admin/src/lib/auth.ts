'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Role } from '@/lib/database.types'

export type SessionUser = {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
  role: Role
  isBanned: boolean
}

/**
 * Current browser session (server-side). Banned users ko nikaal deta hai.
 * Returns null agar logged-out.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServer()
  const {
    data: { session }
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  // profile role/ban pehle DB se verify karo (session hi sahara nahi).
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, is_banned, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.is_banned) return null

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile.full_name ?? (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? null,
    avatarUrl: profile.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    role: (profile.role as Role) ?? 'user',
    isBanned: false
  }
}

/** Admin panel ke har protected layout/page me call karo. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentSession()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/forbidden')
  return user
}

/** Moderator ya admin kaafi ho (content) ke liye. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentSession()
  if (!user) redirect('/login')
  if (!['admin', 'moderator'].includes(user.role)) redirect('/forbidden')
  return user
}

/** 'use client' components ke liye simple boolean. */
export async function isAdmin(): Promise<boolean> {
  const u = await getCurrentSession()
  return u?.role === 'admin' && !u.isBanned
}