'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, getClientIp, isBootstrapAdmin, isValidEmail, assertSameSiteOrigin } from '@/lib/security'
import { logAudit } from '@/lib/audit'
import type { Role } from '@/lib/database.types'

export type LoginState = { error?: string; success?: boolean } | null

/**
 * Email/password sign in — server-side (Supabase API), IP rate limited.
 * Brute-force ke khilaf 10 attempts / 15 min / IP.
 */
export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await assertSameSiteOrigin()
  } catch {
    return { error: 'Invalid request origin.' }
  }

  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  if (!isValidEmail(email) || password.length < 8) {
    return { error: 'Invalid email or password.' }
  }

  const ip = await getClientIp()
  if (rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
    return { error: 'Too many attempts. Try again in 15 minutes.' }
  }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'Incorrect email or password.' }
  }

  // ── Bootstrap: ADMIN_EMAILS me email ho to role=admin set karo ──
  if (isBootstrapAdmin(email)) {
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (existing && existing.role !== 'admin') {
      await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
      await logAudit({
        action: 'admin.bootstrap',
        actorId: data.user.id,
        actorEmail: email,
        targetType: 'profile',
        targetId: data.user.id,
        metadata: { note: 'Role elevated to admin via ADMIN_EMAILS' }
      })
    }
  }

  await logAudit({
    action: 'auth.login',
    actorId: data.user.id,
    actorEmail: email,
    targetType: 'session'
  })

  redirect('/admin')
}

export async function signInWithGoogle(): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const supabase = await createSupabaseServer()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${siteUrl}/api/auth/callback` }
  })
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServer()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (user) {
    await logAudit({
      action: 'auth.logout',
      actorId: user.id,
      actorEmail: user.email,
      targetType: 'session'
    })
  }
  await supabase.auth.signOut()
  redirect('/login')
}