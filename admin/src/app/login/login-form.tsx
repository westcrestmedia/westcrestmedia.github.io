'use client'

import { useActionState, useState } from 'react'
import { login, signInWithGoogle } from './actions'
import type { LoginState } from './actions'

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null)
  const [show, setShow] = useState(false)

  return (
    <div>
      <button className="btn" type="button" style={{ width: '100%', justifyContent: 'center', marginBottom: 18 }} onClick={() => signInWithGoogle()}>
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted-dim)', fontSize: 11, margin: '0 0 18px' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        or with email
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {state?.error && <div className="alert error">{state.error}</div>}

      <form action={formAction}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@westcrestmedia.in" />
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type={show ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: '100%', padding: 11 }}>
          {pending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <label className="checkbox" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show password
      </label>
    </div>
  )
}