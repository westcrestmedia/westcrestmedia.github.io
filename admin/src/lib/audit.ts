'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/security'

/**
 * Server-side audit log. Sirf admin actions yahan record hote hain.
 * Service-role client core leti hai taaki admins apne is_admin check bina
 * kisi RLS issue ke log likh saken.
 */
export async function logAudit(opts: {
  action: string
  actorId?: string | null
  actorEmail?: string | null
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const ip = await getClientIp()
    const admin = createAdminClient()
    await admin
      .from('audit_logs')
      .insert({
        actor_id: opts.actorId ?? null,
        actor_email: opts.actorEmail ?? null,
        action: opts.action,
        target_type: opts.targetType ?? null,
        target_id: opts.targetId ?? null,
        metadata: opts.metadata ? JSON.parse(JSON.stringify(opts.metadata)) : null,
        ip
      })
  } catch {
    // logging failure kabhi main flow break na kare
  }
}