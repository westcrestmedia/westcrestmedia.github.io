'use server'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertSameSiteOrigin, sanitizeText } from '@/lib/security'
import { logAudit } from '@/lib/audit'

const STRING_KEYS = ['site_name', 'site_tagline', 'admin_notification_email', 'google_site_verification']
const BOOL_KEYS = ['maintenance_mode', 'allow_signups', 'review_auto_approve']

export async function saveSettings(formData: FormData): Promise<void> {
  await assertSameSiteOrigin()
  const admin = await requireAdmin()

  const adm = createAdminClient()
  const changes: Record<string, string> = {}

  for (const key of STRING_KEYS) {
    const val = sanitizeText(formData.get(key), 500).trim()
    changes[key] = val
    await adm.from('site_settings').upsert({ key, value: val, value_type: 'string', updated_by: admin.id })
  }

  for (const key of BOOL_KEYS) {
    const val = formData.get(key) === '1' ? 'true' : 'false'
    changes[key] = val
    await adm.from('site_settings').upsert({ key, value: val, value_type: 'boolean', updated_by: admin.id })
  }

  await logAudit({
    action: 'settings.update',
    actorId: admin.id,
    actorEmail: admin.email,
    targetType: 'site_settings',
    metadata: changes
  })

  redirect('/admin/settings?ok=saved')
}