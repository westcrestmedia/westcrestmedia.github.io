'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

/**
 * Supabase client for the browser. Uses the PUBLIC anon key.
 * Security is NOT enforced by hiding this key — it is enforced by
 * Row-Level-Security (RLS) policies on the database.
 */
export function createSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing in environment.')
  }
  return createBrowserClient<Database>(url, anon)
}