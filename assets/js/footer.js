/**
 * footer.js — Auto-injects site footer + its CSS
 * Usage: <script src="/assets/js/footer.js"></script>
 * Place just before </body> — no manual footer HTML needed
 */

(function () {
  // CSS inject (agar already nahi hai)
  if (!document.getElementById('wm-footer-css')) {
    const link = document.createElement('link');
    link.id   = 'wm-footer-css';
    link.rel  = 'stylesheet';
    link.href = '/assets/css/footer.css';
    document.head.appendChild(link);
  }

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <p>© ${new Date().getFullYear()} Westcrest Media</p>
    <div class="footer-links">
      <a href="https://westcrestmedia.in/">Home</a>
      <a href="https://westcrestmedia.in/services/">Services</a>
      <a href="https://westcrestmedia.in/portfolio/">Portfolio</a>
      <a href="https://westcrestmedia.in/shop/">Shop</a>
      <a href="https://westcrestmedia.in/#contact">Contact</a>
    </div>
  `;
  const target = document.getElementById('site-footer');
  if (target) target.replaceWith(footer);
  else document.body.appendChild(footer);
})();
