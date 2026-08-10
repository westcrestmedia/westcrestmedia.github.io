import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Access Denied', robots: { index: false } }

export default function ForbiddenPage() {
  return (
    <div className="center-page">
      <div className="center-card">
        <div className="bc-badge">403</div>
        <h1>You don&apos;t have access</h1>
        <p>
          This area is restricted to Westcrest administrators. If you believe this is a
          mistake, contact the site owner.
        </p>
        <a href="/" className="btn btn-primary">Back to home</a>
      </div>
    </div>
  )
}