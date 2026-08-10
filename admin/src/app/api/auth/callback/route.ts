import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { isBootstrapAdmin } from '@/lib/security'
import { logAudit } from '@/lib/audit'

/**
 * OAuth callback — code exchange + admin bootstrap for Google login.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      }
    }
  })

  const redirectTo = `${url.origin}/admin`

  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=missing_code`)
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      return NextResponse.redirect(`${url.origin}/login?error=auth_failed`)
    }
    const user = data.user
    const email = user.email

    if (isBootstrapAdmin(email)) {
      const admin = createAdminClient()
      const { data: existing } = await admin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
      if (existing && existing.role !== 'admin') {
        await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id)
      }
    }

    await logAudit({
      action: 'auth.login.oauth',
      actorId: user.id,
      actorEmail: email,
      targetType: 'session',
      metadata: { provider: 'google' }
    })
  } catch {
    return NextResponse.redirect(`${url.origin}/login?error=auth_failed`)
  }

  return NextResponse.redirect(redirectTo)
}