import type { Metadata } from 'next'
import LoginForm from './login-form'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div className="login-body">
      <div className="login-brand">
        <div className="lb-kicker">Westcrest Media · Admin</div>
        <h2>
          Secure control
          <br />
          center for your site.
        </h2>
        <p>
          Manage users, moderate reviews, publish content and review security audits — all
          from one place. Sessions and secrets are handled server-side.
        </p>
        <div className="lb-foot">© 2026 Westcrest Media · westcrestmedia.in</div>
      </div>

      <div className="login-form-side">
        <div className="login-card">
          <h1>Welcome back</h1>
          <p className="lc-sub">Sign in to the Westcrest admin panel.</p>
          <LoginForm />
          <form action="https://westcrestmedia.in">
            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
              ← Back to website
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}