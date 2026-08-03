/**
 * header-landing.js — Landing Page Header
 */

import { supabase, getRedirectTarget, redirectAfterLogin } from '/assets/js/auth.js'

function renderNav(user) {
  const name    = user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
  const avatar  = user?.user_metadata?.avatar_url || null
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  document.getElementById('navbar').innerHTML = `
    <a href="/" class="nav-logo">
      <img src="/images/logo.png" alt="Westcrest Media" width="180" height="52" />
    </a>

    <ul class="nav-links">
      <li class="nav-dropdown"><a href="#tools">Tools</a>
        <div class="dropdown-menu">
          <div class="dropdown-menu-grid">
            <div>
              <div class="dropdown-label">🖼️ Image Tools</div>
              <a href="/tools/image-converter/"><span class="drop-icon-sm">🖼️</span>Image Converter</a>
              <a href="/tools/image-compressor/"><span class="drop-icon-sm">⚡</span>Image Compressor</a>
              <a href="/tools/background-remover/"><span class="drop-icon-sm">✂️</span>Background Remover</a>
              <a href="/tools/image-resizer-pro/"><span class="drop-icon-sm">📐</span>Image Resizer Pro</a>
            </div>
            <div>
              <div class="dropdown-label">🎬 Video Tools</div>
              <a href="/tools/thumbnail-maker/"><span class="drop-icon-sm">🎬</span>Thumbnail Maker</a>
              <a href="/tools/lut-preview/"><span class="drop-icon-sm">🎞️</span>LUT Studio</a>
              <a href="/tools/aspect-ratio/"><span class="drop-icon-sm">📐</span>Aspect Ratio Calc</a>
              <a href="/tools/color-palette/"><span class="drop-icon-sm">🎨</span>Color Palette</a>
            </div>
            <div>
              <div class="dropdown-label">✨ AI & Other</div>
              <a href="/tools/image-prompt/"><span class="drop-icon-sm">🎴</span>Image Prompts</a>
              <a href="/tools/video-prompt/"><span class="drop-icon-sm">🎥</span>Video Prompts</a>
              <a href="/tools/font-pairing/"><span class="drop-icon-sm">🔤</span>Font Pairing</a>
              <a href="/tools/pdf-studio/"><span class="drop-icon-sm">📑</span>PDF Studio</a>
            </div>
          </div>
        </div>
      </li>
      <li><a href="/services/">Services</a></li>
      <li><a href="/portfolio/">Portfolio</a></li>
      <li><a href="/shop/">Shop</a></li>
      <li><a href="#process">Process</a></li>
      <li><a href="/about/">About</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>

    <div class="nav-right">
      <a href="#contact" class="nav-cta">Start a Project</a>

      ${user ? `
        <div id="wm-avatar-wrap" style="position:relative;">
          <button id="wm-avatar-btn" aria-label="Account menu" aria-expanded="false">
            ${avatar ? `<img src="${avatar}" alt="${name}" width="36" height="36" />` : initial}
          </button>
          ${dropdownHTML(name, user.email)}
        </div>
      ` : `
        <a href="/login/?next=/" class="nav-signin" id="wm-signin-btn">Sign In</a>
      `}

      <button class="hamburger" id="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" onclick="toggleMobile()">
        <span></span><span></span><span></span>
      </button>
    </div>
  `

  bindDropdown()
  initToolsDropdown()
}


function dropdownHTML(name, email) {
  return `
    <div id="wm-dropdown" class="wm-user-dropdown">
      <div class="wm-user-dropdown-header">
        <div class="wm-user-dropdown-name">${name}</div>
        <div class="wm-user-dropdown-email">${email}</div>
      </div>
      <div class="wm-user-dropdown-body">
        <a href="/dashboard/" class="wm-dd-link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
          Dashboard
        </a>
        <a href="/dashboard/#bookmarks" class="wm-dd-link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1h8a1 1 0 0 1 1 1v10l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          Bookmarks
        </a>
        <a href="/dashboard/#downloads" class="wm-dd-link">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Downloads
        </a>
        <div class="wm-user-dropdown-divider"></div>
        <button id="wm-signout-btn" class="wm-dd-link signout">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sign Out
        </button>
      </div>
    </div>
  `
}


function initToolsDropdown() {
  const li = document.querySelector('.nav-dropdown')
  const dd = li?.querySelector('.dropdown-menu')
  if (!li || !dd) return

  let closeTimer = null

  const openDD  = () => { clearTimeout(closeTimer); dd.style.display = 'block' }
  const closeDD = () => { closeTimer = setTimeout(() => { dd.style.display = 'none' }, 150) }

  li.addEventListener('mouseenter', openDD)
  li.addEventListener('mouseleave', closeDD)
  dd.addEventListener('mouseenter', openDD)
  dd.addEventListener('mouseleave', closeDD)


}

function bindDropdown() {
  const btn = document.getElementById('wm-avatar-btn')
  const dd  = document.getElementById('wm-dropdown')
  if (!btn || !dd) return

  btn.addEventListener('click', e => {
    e.stopPropagation()
    const open = dd.style.display === 'block'
    dd.style.display = open ? 'none' : 'block'
    btn.setAttribute('aria-expanded', !open)
  })
  document.addEventListener('click', () => {
    if (dd) dd.style.display = 'none'
  })

  document.getElementById('wm-signout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })
}

function initActiveNav() {
  const path = window.location.pathname
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path) a.classList.add('active')
  })
}

function initScroll() {
  const nav = document.getElementById('navbar')
  if (!nav) return
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40)
  }, { passive: true })
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  renderNav(session?.user ?? null)
  initScroll()
  initActiveNav()

  supabase.auth.onAuthStateChange((_e, session) => {
    renderNav(session?.user ?? null)
  })
}

init()
