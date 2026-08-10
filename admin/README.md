# Westcrest Media — Admin Panel

A production-grade, server-side admin panel for **Westcrest Media** built with **Next.js 15 (App Router) + Supabase**. All secret keys live in `.env.local` (server-side only) — they are **never** exposed to the browser.

The existing public site (GitHub Pages static site) is **untouched**. This admin panel is a separate deployable app that manages the same Supabase database.

---

## 🔐 Security model (why this is safe)

| Concern | Solution |
|---|---|
| Secret keys in the browser? | **No.** `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix, so Next.js never inlines it into client JS. The file `src/lib/supabase/admin.ts` is marked `server-only` and throws at build time if any client component imports it. |
| Admin access | Enforced **server-side** in `middleware.ts` + `src/lib/auth.ts` (`requireAdmin`) + DB role check. There is no client-side "if you're an admin show X" logic to bypass. |
| Row-Level-Security | `supabase/schema.sql` enables RLS on `profiles`, `audit_logs`, `content`, `site_settings`. Users can only see their own profile; staff/admin gates via `is_admin()`/`is_staff()` SQL functions. |
| Brute force | IP-based rate limiting on login (10 attempts / 15 min) in `src/lib/security.ts`. |
| CSRF | Every Server Action checks `Origin`/`Host` (`assertSameSiteOrigin`) + Next.js built-in same-origin protection. |
| XSS | User input is sanitized server-side (`sanitizeText`) before DB write; all output is React-escaped. |
| Banned users | `getCurrentSession()` returns `null` for banned users and their sessions are revoked via the Admin API. |
| Headers | Strict CSP, `X-Frame-Options: DENY`, `nosniff`, HSTS, `frame-ancestors 'none'` — set in `next.config.mjs` + middleware. |
| Audit trail | Every admin action (role change, ban, review moderation, content CRUD, settings) is written to `audit_logs`. |

---

## 📁 Project structure

```
admin/
├─ middleware.ts                    # session refresh + route guard
├─ next.config.mjs                  # security headers, no powered-by header
├─ supabase/schema.sql              # tables + RLS (run once in Supabase)
├─ src/
│  ├─ lib/
│  │  ├─ supabase/admin.ts          # SERVICE-ROLE client (server-only)
│  │  ├─ supabase/server.ts         # SSR client (anon, cookies) for session
│  │  ├─ supabase/browser.ts        # client-side anon client
│  │  ├─ security.ts                # rate limit, CSRF, sanitize, bootstrap admins
│  │  ├─ audit.ts                   # audit log writer
│  │  ├─ auth.ts                    # requireAdmin / requireStaff / session
│  │  └─ database.types.ts          # typed Supabase schema
│  └─ app/
│     ├─ login/                     # sign in (rate limited)
│     ├─ admin/                     # dashboard, users, reviews, content, audit, settings
│     ├─ api/auth/callback/         # OAuth callback (admin bootstrap)
│     └─ forbidden/                 # 403
```

---

## 🚀 Setup

### 1. Requirements
- Node.js 20+
- A Supabase project (the same one the public site already uses)

### 2. Install
```bash
cd admin
npm install
```

### 3. Environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:

| Variable | Where to get it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | No (public by design) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | No (public; RLS provides security) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role) | **YES — server only** |
| `ADMIN_EMAILS` | Your own admin email(s), comma separated | No (but keep private) |
| `NEXT_PUBLIC_SITE_URL` | e.g. `http://localhost:3000` (dev) / `https://admin.yourdomain.com` (prod) | No |

> ⚠️ Never commit `.env.local`. It is gitignored.
> ⚠️ Never give the service role key a `NEXT_PUBLIC_` prefix.

### 4. Database setup (one-time)
Open **Supabase → SQL Editor**, paste the entire contents of `supabase/schema.sql`, and run it.

This creates:
- `profiles` (role: `user`/`moderator`/`admin`, `is_banned`) + trigger that auto-creates a profile on signup
- `audit_logs`, `content` (blog/page/tool), `site_settings`
- RLS policies + `is_admin()` / `is_staff()` helpers

### 5. Run
```bash
npm run dev        # http://localhost:3000
```

### 6. Your first admin login
1. Log in with the email listed in `ADMIN_EMAILS`.
2. The login action auto-elevates that account to `role = 'admin'`.
3. You land in `/admin`.

> For Google OAuth login, add the callback URL
> `https://<your-domain>/api/auth/callback` to
> Supabase → Authentication → URL Configuration → Redirect URLs.

---

## ☁️ Deploy to Vercel

1. Push this `admin/` folder to a separate GitHub repo (or as a Vercel project pointing to this folder).
2. In Vercel: set the **same environment variables** from `.env.local` (Service Role key included — it only ever lives server-side).
3. Add the production URL to Supabase redirect URLs + Google OAuth.

**Optional:** put the admin panel on its own subdomain (e.g. `admin.westcrestmedia.in`) so it is not publicly discoverable next to the marketing site.

---

## 🛠 Features

- **Dashboard** — users / reviews / pending / downloads / bookmarks counters, latest sign-ups, moderation queue
- **Users** — search, filter by role, change role (RBAC), ban/unban (with session revocation), delete account (Auth Admin API)
- **Reviews** — approve / unapprove / delete, filter by status
- **Content** — CRUD for blog posts, pages and tools with publish/draft + SEO meta
- **Audit log** — every admin action with actor, target, IP, timestamp
- **Settings** — site name, tagline, maintenance mode, signup toggle, review auto-approve, env status panel
- **Security** — rate-limited login, CSRF/origin checks, sanitization, security headers, RLS, server-only secrets

---

## 🔧 Production hardening notes

- **Multi-node rate limiting:** the built-in limiter is in-memory. For a scaled deployment, replace `rateLimit()` in `src/lib/security.ts` with a Redis-backed limiter (e.g. Upstash).
- **2FA:** add Supabase's built-in MFA (`supabase.auth.mfa`) to the login flow for full industry-standard 2FA.
- **Backups:** enable daily backups on your Supabase project.
- **Monitoring:** add a health-check or error tracker (Sentry) for the admin routes.

## ─────────────────────────────────────

**Westcrest Media · Admin** — © 2026
