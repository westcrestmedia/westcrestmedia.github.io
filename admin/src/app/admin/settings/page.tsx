import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveSettings } from './actions'

export const metadata: Metadata = { title: 'Settings' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ ok?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const admin = createAdminClient()
  const { data: rows } = await admin.from('site_settings').select('key, value')

  const get = (key: string): string => {
    const row = rows?.find((r) => r.key === key)
    return row?.value ?? ''
  }
  const getBool = (key: string): boolean => get(key) === 'true'

  const env = [
    { label: 'Supabase URL', ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { label: 'Supabase Anon Key', ok: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { label: 'Service Role Key (server-only)', ok: !!process.env.SUPABASE_SERVICE_ROLE_KEY, secret: true },
    { label: 'Bootstrap Admin Emails', ok: !!process.env.ADMIN_EMAILS }
  ]

  return (
    <>
      {sp.ok && <div className="alert success">✓ Settings saved</div>}

      <div className="panel">
        <div className="panel-head"><div className="panel-title">General Settings</div></div>
        <form action={saveSettings} className="panel-body">
          <div className="form-grid">
            <div className="field">
              <label>Site name</label>
              <input name="site_name" defaultValue={get('site_name')} />
            </div>
            <div className="field">
              <label>Site tagline</label>
              <input name="site_tagline" defaultValue={get('site_tagline')} />
            </div>
            <div className="field col-span-2">
              <label>Admin notification email</label>
              <input name="admin_notification_email" type="email" defaultValue={get('admin_notification_email')} />
              <span className="hint">System alerts ke liye.</span>
            </div>
            <div className="field col-span-2">
              <label>Google site verification code</label>
              <input name="google_site_verification" defaultValue={get('google_site_verification')} />
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label className="checkbox">
              <input type="checkbox" name="maintenance_mode" value="1" defaultChecked={getBool('maintenance_mode')} />
              Maintenance mode
            </label>
            <label className="checkbox">
              <input type="checkbox" name="allow_signups" value="1" defaultChecked={getBool('allow_signups')} />
              Allow signups
            </label>
            <label className="checkbox">
              <input type="checkbox" name="review_auto_approve" value="1" defaultChecked={getBool('review_auto_approve')} />
              Auto-approve reviews
            </label>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit">Save settings</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-head"><div className="panel-title">Environment & Security Status</div></div>
        <div className="panel-body">
          <table className="data">
            <thead><tr><th>Secret / Config</th><th>Status</th><th>Exposure</th></tr></thead>
            <tbody>
              {env.map((e) => (
                <tr key={e.label}>
                  <td>{e.label}</td>
                  <td>
                    {e.ok ? <span className="pill green">configured</span> : <span className="pill red">missing</span>}
                  </td>
                  <td className="cell-muted">{e.secret ? 'Server-only (.env)' : 'Public (NEXT_PUBLIC)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 14, color: 'var(--muted-dim)' }}>
            Service role key sirf server-side files me hota hai (prefix <code>NEXT_PUBLIC_</code> nahi hota) isliye browser bundle me kabhi nahi jaata.
          </p>
        </div>
      </div>
    </>
  )
}