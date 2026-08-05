(function () {
  const currentURL = window.location.href;

  // Current tool dhundo
  const currentTool = WC_TOOLS.find(tool =>
    currentURL.includes(tool.url.replace("https://westcrestmedia.in", ""))
  );

  // Related tools filter karo
  let otherTools = [];
  if (currentTool && currentTool.related) {
    otherTools = currentTool.related
      .map(slug => WC_TOOLS.find(t => t.url.includes("/" + slug + "/")))
      .filter(Boolean)
      .filter(t => t.url !== currentTool.url)
      .slice(0, 4);
  } else {
    // Fallback: current tool minus karke pehle 4
    otherTools = WC_TOOLS.filter(tool =>
      !currentURL.includes(tool.url.replace("https://westcrestmedia.in", ""))
    ).slice(0, 4);
  }

  const section = document.createElement("section");
  section.className = "wc-section";
  section.style.paddingTop = "0";
  section.style.paddingBottom = "2rem";

  const grid = otherTools.map(tool => `
    <a href="${tool.url}" class="wc-tool-card">
      <div class="wc-tool-icon">${tool.icon}</div>
      <div>
        <div class="wc-tool-name">${tool.name}</div>
        <div class="wc-tool-desc">${tool.desc}</div>
      </div>
      <span class="wc-tool-arrow">→</span>
    </a>
  `).join("");

  section.innerHTML = `
    <p class="wc-sec-tag">More Free Tools</p>
    <h2 class="wc-sec-heading">Explore Our <em>Tools</em></h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem;margin-bottom:1.2rem;">
      ${grid}
    </div>
    <a href="https://westcrestmedia.in/tools/" style="font-size:12px;color:#c8a96e;text-decoration:none;letter-spacing:.08em;font-weight:600;">View All Tools →</a>
  `;

  const target = document.getElementById("explore-tools");
  if (target) target.replaceWith(section);
})();
