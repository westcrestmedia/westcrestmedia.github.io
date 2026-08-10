import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * PRIVILEGED Supabase client.
 *
 * ⚠️ SECURITY CRITICAL:
 *  - Uses SUPABASE_SERVICE_ROLE_KEY which BYPASSES Row-Level-Security.
 *  - This file is marked 'use server' + only imported by server code.
 *  - NEVER import this from a Client Component, never prefix the env var
 *    with NEXT_PUBLIC_ (that would expose it in the browser bundle).
 *
 * Kisi regular user ko RLS se aise data nahi dikhna chahiye jo is client se
 * aata hai. Isliye ye SIRF admin-protected server code me use hota hai.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.')
  }

  return createClient<Database>(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/** Convenience — admin client use karke 403-safe schema access. */
export async function withAdminClient<T>(
  fn: (client: ReturnType<typeof createAdminClient>) => Promise<T>
): Promise<T> {
  return fn(createAdminClient())
}