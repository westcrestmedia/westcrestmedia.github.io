/**
 * header-tool.js — Tool Pages Header
 */

import { supabase } from '/assets/js/auth.js'

const TOOLS = [
  { col: '🖼️ Image Tools', items: [
    { slug: 'image-converter',    name: 'Image Converter',        emoji: '🖼️', url: '/tools/image-converter/' },
    { slug: 'image-compressor',   name: 'Image Compressor',       emoji: '⚡', url: '/tools/image-compressor/' },
    { slug: 'background-remover', name: 'Background Remover',     emoji: '✂️', url: '/tools/background-remover/' },
    { slug: 'image-resizer-pro',  name: 'Image Resizer Pro',      emoji: '📐', url: '/tools/image-resizer-pro/' },
    { slug: 'photo-editor-pro',   name: 'Photo Editor Pro',       emoji: '🖌️', url: '/tools/photo-editor-pro/' },
  ]},
  { col: '🎬 Video Tools', items: [
    { slug: 'thumbnail-maker',    name: 'Thumbnail Maker',        emoji: '🎬', url: '/tools/thumbnail-maker/' },
    { slug: 'lut-preview',        name: 'LUT Studio',             emoji: '🎞️', url: '/tools/lut-preview/' },
    { slug: 'aspect-ratio',       name: 'Aspect Ratio Calc',      emoji: '📐', url: '/tools/aspect-ratio/' },
    { slug: 'color-palette',      name: 'Color Palette',          emoji: '🎨', url: '/tools/color-palette/' },
  ]},
  { col: '🎵 Audio Tools', items: [
    { slug: 'audio-converter',    name: 'Audio Converter',        emoji: '🎵', url: '/tools/audio-converter/' },
  ]},
  { col: '✨ AI & Other', items: [
    { slug: 'image-prompt',       name: 'Image Prompts',          emoji: '🎴', url: '/tools/image-prompt/' },
    { slug: 'video-prompt',       name: 'Video Prompts',          emoji: '🎥', url: '/tools/video-prompt/' },
    { slug: 'font-pairing',       name: 'Font Pairing',           emoji: '🔤', url: '/tools/font-pairing/' },
    { slug: 'pdf-studio',         name: 'PDF Studio',             emoji: '📑', url: '/tools/pdf-studio/' },
  ]},
]

async function renderNav() {
  const nav = document.getElementById('tool-nav')
  if (!nav) return

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tool = window.__WM_TOOL__ || {}

  const dropdownCols = TOOLS.map(function(group) {
    const links = group.items.map(function(t) {
      const isCurrent = t.slug === tool.slug
      if (isCurrent) {
        return '<a class="current-tool">' +
          '<span class="tool-icon">' + t.emoji + '</span>' + t.name +
          '<span class="current-tool-badge">Open</span>' +
        '</a>'
      }
      return '<a href="' + t.url + '"><span class="tool-icon">' + t.emoji + '</span>' + t.name + '</a>'
    }).join('')
    return '<div class="tools-col"><div class="tools-col-label">' + group.col + '</div>' + links + '</div>'
  }).join('')

  const name   = user ? (user.user_metadata?.full_name || user.email?.split('@')[0] || '') : ''
  const avatar = user ? (user.user_metadata?.avatar_url || null) : null
  const initial = name ? name.charAt(0).toUpperCase() : '?'

  const avatarHTML = avatar
    ? '<img src="' + avatar + '" alt="' + name + '" width="32" height="32" style="width:100%;height:100%;object-fit:cover;" />'
    : initial

  const rightHTML = user
    ? '<div style="position:relative;">' +
        '<button id="wm-avatar-btn" aria-label="Account menu" aria-expanded="false" style="width:32px;height:32px;border-radius:50%;border:1.5px solid #C9A84C;cursor:pointer;background:rgba(200,169,110,0.12);overflow:hidden;display:flex;align-items:center;justify-content:center;color:#C9A84C;font-weight:700;font-size:13px;padding:0;font-family:Syne,sans-serif;">' +
          avatarHTML +
        '</button>' +
        '<div id="wm-dropdown" style="display:none;position:absolute;right:0;top:calc(100% + 10px);width:220px;background:#131313;border:1px solid #242424;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,0.6);z-index:9999;overflow:hidden;">' +
          '<div style="padding:14px 16px 12px;border-bottom:1px solid #1e1e1e;">' +
            '<div style="color:#f0ede6;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
            '<div style="color:#555;font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + user.email + '</div>' +
          '</div>' +
          '<div style="padding:6px 0;">' +
            '<a href="/dashboard/" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:Syne,sans-serif;">Dashboard</a>' +
            '<a href="/dashboard/#bookmarks" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:Syne,sans-serif;">Bookmarks</a>' +
            '<a href="/dashboard/#downloads" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#999;font-size:12.5px;text-decoration:none;font-family:Syne,sans-serif;">Downloads</a>' +
            '<div style="height:1px;background:#1e1e1e;margin:4px 0;"></div>' +
            '<button id="wm-signout-btn" style="display:flex;align-items:center;gap:10px;padding:9px 16px;color:#666;font-size:12.5px;font-family:Syne,sans-serif;background:none;border:none;cursor:pointer;width:100%;text-align:left;">Sign Out</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    : '<a href="/login/?next=' + encodeURIComponent(window.location.pathname) + '" style="font-family:DM Mono,monospace;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold);text-decoration:none;padding:7px 16px;border:1px solid rgba(200,169,110,0.4);border-radius:2px;transition:background .2s;" onmouseover="this.style.background=\'rgba(200,169,110,0.1)\'" onmouseout="this.style.background=\'transparent\'">Sign In</a>'

  nav.innerHTML =
    '<a href="/" class="nav-logo" style="margin-right:16px;"><img src="/images/w_logo.svg" alt="Westcrest Media" width="26" height="26" style="height:26px;"></a>' +
    '<button class="nav-tools-btn" id="toolsBtn" aria-label="Toggle tools menu" aria-expanded="false" onclick="window.__toggleToolsDD()">All Tools<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>' +
    '<div class="tools-dropdown" id="toolsDropdown"><div class="tools-dropdown-grid">' + dropdownCols + '</div></div>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-left:auto;">' + rightHTML + '</div>'



  bindInteractions(user)
}

function bindInteractions(user) {
  window.__toggleToolsDD = function() {
    var btn = document.getElementById('toolsBtn')
    var dd  = document.getElementById('toolsDropdown')
    if (!dd) return
    var open = dd.classList.toggle('open')
    if (btn) {
      btn.classList.toggle('open', open)
      btn.setAttribute('aria-expanded', open)
    }
  }
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#toolsBtn') && !e.target.closest('#toolsDropdown')) {
      var dd = document.getElementById('toolsDropdown')
      var btn = document.getElementById('toolsBtn')
      if (dd) dd.classList.remove('open')
      if (btn) {
        btn.classList.remove('open')
        btn.setAttribute('aria-expanded', false)
      }
    }
  })

  var avatarBtn = document.getElementById('wm-avatar-btn')
  var dd = document.getElementById('wm-dropdown')
  if (avatarBtn && dd) {
    avatarBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      var open = dd.style.display === 'block'
      dd.style.display = open ? 'none' : 'block'
      avatarBtn.setAttribute('aria-expanded', !open)
    })
    document.addEventListener('click', function() {
      if (dd) dd.style.display = 'none'
      if (avatarBtn) avatarBtn.setAttribute('aria-expanded', false)
    })
  }

  var signoutBtn = document.getElementById('wm-signout-btn')
  if (signoutBtn) {
    signoutBtn.addEventListener('click', async function() {
      await supabase.auth.signOut()
      window.location.reload()
    })
  }
}

renderNav()
