/**
 * landing-footer.js — Auto-injects landing page footer + its CSS
 * Usage: <script src="/assets/js/landing-footer.js"></script>
 * Include only on: index.html (landing page)
 * Place just before </body> — no manual footer HTML needed
 * Pair with: landing-footer.css
 */

(function () {
  // CSS inject (agar already nahi hai)
  if (!document.getElementById('wm-landing-footer-css')) {
    const link = document.createElement('link');
    link.id   = 'wm-landing-footer-css';
    link.rel  = 'stylesheet';
    link.href = '/assets/css/landing-footer.css';
    document.head.appendChild(link);
  }

  const footer = document.createElement('footer');
  footer.innerHTML = `
    <div class="container">
      <div class="footer-top">
        <div>
          <img src="/images/logo.png" alt="Westcrest Media" width="110" height="110" style="height:110px; width:auto; object-fit:contain; mix-blend-mode:lighten;" />
          <div class="footer-tagline">Premium Video & Motion Studio</div>
        </div>
        <div class="footer-links-group">
          <div class="footer-col">
            <h3 class="footer-col-heading">Services</h3>
            <ul>
              <li><a href="/services/">Video Editing</a></li>
              <li><a href="/services/">Motion Graphics</a></li>
              <li><a href="/services/">Color Grading</a></li>
              <li><a href="/services/">VFX & Animation</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3 class="footer-col-heading">Shop</h3>
            <ul>
              <li><a href="https://westcrestmedia.gumroad.com/" target="_blank">AE Plugins</a></li>
              <li><a href="https://westcrestmedia.gumroad.com/" target="_blank">LUT Packs</a></li>
              <li><a href="https://westcrestmedia.gumroad.com/" target="_blank">Project Files</a></li>
              <li><a href="https://westcrestmedia.gumroad.com/" target="_blank">Bundles</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h3 class="footer-col-heading">Company</h3>
            <ul>
              <li><a href="/about/">About Us</a></li>
              <li><a href="/blog/">Blog</a></li>
              <li><a href="/portfolio/">Portfolio</a></li>
              <li><a href="/services/">Our Process</a></li>
              <li><a href="/portfolio/">Testimonials</a></li>
              <li><a href="/#contact">Contact</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copy">© ${new Date().getFullYear()} Westcrest Media. All rights reserved.</div>
        <div class="footer-legal">
          <a href="/privacy-policy/">Privacy Policy</a>
          <span class="footer-legal-sep">|</span>
          <a href="/terms/">Terms &amp; Conditions</a>
          <span class="footer-legal-sep">|</span>
          <a href="/disclaimer/">Disclaimer</a>
        </div>
        <div class="social-links">
          <!-- Instagram -->
          <a class="social-link" href="https://www.instagram.com/westcrestmedia/" target="_blank" title="Instagram">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
          <!-- YouTube -->
          <a class="social-link" href="https://www.youtube.com/@westcrestmedia" target="_blank" title="YouTube">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
          <!-- Facebook -->
          <a class="social-link" href="https://www.facebook.com/westcrestmedia" target="_blank" title="Facebook">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <!-- Behance -->
          <a class="social-link" href="https://www.behance.net/westcrestmedia" target="_blank" title="Behance">
            <svg width="18" height="18" viewBox="0 0 640 640" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M185.577 119.517c18.862 0 35.847 1.642 51.331 5.008 15.52 3.236 28.63 8.752 39.757 16.24 10.996 7.512 19.476 17.516 25.748 29.989 6 12.354 9 27.862 9 46.229 0 19.878-4.476 36.355-13.512 49.63-9.118 13.24-22.358 24-40.122 32.516 24.236 6.993 42.118 19.24 54.118 36.627 11.989 17.516 17.753 38.504 17.753 63.225 0 19.996-3.886 37.11-11.469 51.615-7.748 14.634-18.248 26.492-31.11 35.634-12.993 9.236-27.993 15.992-44.753 20.363-16.642 4.346-33.756 6.626-51.45 6.626H0V119.553l185.601.012-.023-.048zm232.042 31.76h159.616v38.883l-159.616-.012v-38.883.012zm35.469 293.448c11.764 11.469 28.63 17.233 50.646 17.233 15.745 0 29.516-4.016 40.867-12.012 11.35-7.996 18.248-16.465 20.882-25.229l68.965.012c-11.126 34.347-27.874 58.749-50.859 73.5-22.642 14.753-50.35 22.241-82.5 22.241-22.524 0-42.627-3.65-60.757-10.772-18.119-7.24-33.237-17.35-45.993-30.638-12.366-13.24-22.11-28.984-28.996-47.493-6.756-18.354-10.229-38.752-10.229-60.744 0-21.367 3.52-41.245 10.477-59.623 7.122-18.52 16.878-34.359 29.87-47.753 12.98-13.382 28.229-24 46.24-31.748 17.883-7.76 37.631-11.646 59.505-11.646 24.107 0 45.225 4.642 63.356 14.126 18 9.355 32.87 21.993 44.492 37.749 11.646 15.768 19.878 33.874 25.004 54.107 5.126 20.232 6.875 41.35 5.469 63.508H433.706c0 22.359 7.512 43.76 19.358 55.1l.024.082zm89.871-149.707c-9.236-10.24-25.122-15.874-44.233-15.874-12.52 0-22.866 2.114-31.11 6.366-8.115 4.229-14.752 9.473-19.878 15.745-4.997 6.248-8.516 13.004-10.465 20.102-1.996 6.874-3.236 13.24-3.65 18.756l127.502-.012c-1.878-19.984-8.752-34.736-18.118-45.106l-.047.023zm-368.662-16.524c15.355 0 28.099-3.65 38.091-11.008 9.992-7.24 14.752-19.24 14.752-35.752 0-9.106-1.63-16.76-4.878-22.642-3.354-5.87-7.76-10.512-13.37-13.748-5.516-3.355-11.74-5.646-19.099-6.886-7.122-1.358-14.634-1.984-22.24-1.984H86.576v91.973h87.745l-.024.047zm4.748 167.59c8.528 0 16.642-.757 24.213-2.528 7.748-1.748 14.634-4.359 20.363-8.35 5.752-3.887 10.641-8.989 14.114-15.745 3.52-6.638 5.126-15.118 5.126-25.477 0-20.232-5.764-34.748-17.114-43.512-11.351-8.646-26.47-12.874-45.214-12.874H86.552V445.93l92.493-.012v.165z"/></svg>
          </a>
          <!-- LinkedIn -->
          <a class="social-link" href="https://www.linkedin.com/in/westcrestmedia/" target="_blank" title="LinkedIn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <!-- Vimeo -->
          <a class="social-link" href="https://vimeo.com/westcrestmedia" target="_blank" title="Vimeo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.17 0-.763.356-1.78 1.075L0 7.522c1.114-.98 2.214-1.96 3.298-2.94C4.769 3.204 5.883 2.48 6.64 2.393c1.834-.17 2.96 1.078 3.408 3.758.487 2.84.823 4.605.993 5.30.549 2.48 1.15 3.717 1.813 3.717.512 0 1.284-.81 2.325-2.43 1.038-1.621 1.592-2.85 1.659-3.699.148-1.4-.401-2.106-1.66-2.106-.591 0-1.197.135-1.816.404 1.207-3.955 3.514-5.882 6.928-5.793 2.529.06 3.72 1.713 3.587 4.862z"/></svg>
          </a>
          <!-- Pinterest -->
          <a class="social-link" href="https://in.pinterest.com/westcrestmedia/" target="_blank" title="Pinterest">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
          </a>
          <!-- Gumroad -->
          <a class="social-link" href="https://westcrestmedia.gumroad.com/" target="_blank" title="Gumroad">
            <svg width="20" height="20" viewBox="0 0 77 77" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="38.5" cy="38.5" r="38.5" fill="currentColor" opacity="0.15"/><path fill="currentColor" d="M35.392 57.272c-10.849 0-17.23-8.701-17.23-19.526 0-11.249 7.02-20.375 20.421-20.375 13.828 0 18.508 9.339 18.72 14.645h-9.998c-.213-2.972-2.765-7.429-8.935-7.429-6.594 0-10.849 5.73-10.849 12.735s4.255 12.734 10.85 12.734c5.956 0 8.509-4.67 9.572-9.338H38.37v-3.82h20.087v19.525h-8.812v-12.31c-.638 4.458-3.404 13.16-14.253 13.16Z"/></svg>
          </a>
        </div>
      </div>
    </div>
  `;
  const target = document.getElementById('landing-footer');
  if (target) target.replaceWith(footer);
  else document.body.appendChild(footer);
})();
