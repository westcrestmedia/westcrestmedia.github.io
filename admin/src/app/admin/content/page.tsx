import type { Metadata } from 'next'
import { requireStaff } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ContentManager } from './content-manager'
import type { ContentItem } from './actions'

export const metadata: Metadata = { title: 'Content' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ContentPage() {
  await requireStaff()
  const admin = createAdminClient()
  const { data } = await admin.from('content').select('*').order('updated_at', { ascending: false })

  return <ContentManager items={(data ?? []) as ContentItem[]} />
}