(function () {
  // ---------- Small helpers ----------
  const baseEl = document.querySelector('base');
  const BASE = baseEl ? baseEl.href : document.baseURI; // absolute URL with trailing slash

  const toURL = (p) => new URL(p, BASE);                 // resolve against <base>
  const trimSlash = (s) => s.replace(/\/+$/, '');
  const samePath = (a, b) => trimSlash(a) === trimSlash(b);

  // ---------- Mark active nav link ----------
  document.addEventListener('DOMContentLoaded', () => {
    const herePath = new URL(location.href).pathname;

    document.querySelectorAll('a[data-nav]').forEach(a => {
      // Resolve the anchor's href against the base
      const hrefURL = toURL(a.getAttribute('href') || '');
      const hrefPath = hrefURL.pathname;

      // Consider both "/path" and "/path/index.html" as the same
      const hereIndex = herePath.endsWith('/') ? herePath + 'index.html' : herePath;
      const linkIndex = hrefPath.endsWith('/') ? hrefPath + 'index.html' : hrefPath;

      if (samePath(herePath, hrefPath) || samePath(hereIndex, linkIndex)) {
        a.classList.add('active');
      }
    });
  });

  // ---------- Footer year & source link ----------
  document.addEventListener('DOMContentLoaded', () => {
    const y = document.getElementById('y');
    if (y) y.textContent = new Date().getFullYear();

    const src = document.getElementById('srcLink');
    if (src) {
      // Prefer placeholders replaced by the Action; otherwise infer for local/dev
      const ownerFromTpl = src.dataset.owner || '${REPO_OWNER}';
      const repoFromTpl  = src.dataset.repo  || '${REPO_NAME}';

      let owner = ownerFromTpl;
      let repo  = repoFromTpl;

      // Fallback inference when viewing locally (placeholders not replaced)
      if (owner.includes('${') || repo.includes('${}')) {
        const u = new URL(BASE);
        if (u.hostname.endsWith('github.io')) {
          owner = u.hostname.replace('.github.io', '');
          // First non-empty path segment is the repo for project pages
          const seg = u.pathname.split('/').filter(Boolean)[0] || '';
          repo = seg || repo;
        }
      }

      // Set final link
      src.href = `https://github.com/${owner}/${repo}`;
    }
  });

  // ---------- Projects loader ----------
  async function loadProjects() {
    const grid = document.getElementById('projectsGrid');
    const msg  = document.getElementById('projectsMsg');
    if (!grid) return;

    const card = (p) => {
      const tags = (p.tags || []).map(t => `<span class="badge">${t}</span>`).join(' ');
      const priv = (p.visibility && p.visibility !== 'public') ? `<span class="badge">private</span>` : '';
      const links = [
        p.link ? `<a class="btn" href="${p.link}" target="_blank" rel="noopener">Demo</a>` : '',
        p.repo ? `<a class="btn" href="${p.repo}" target="_blank" rel="noopener">Repo</a>` : ''
      ].filter(Boolean).join(' ');
      const updated = p.updatedAt ? `<small class="muted">Updated ${p.updatedAt}</small>` : '';
      return `
        <article class="card">
          <h3>${p.title || 'Untitled Project'}</h3>
          <p>${p.summary || ''}</p>
          <p>${tags} ${priv}</p>
          <p>${links}</p>
          ${updated}
        </article>`;
    };

    const renderPlaceholder = () => {
      if (msg) msg.textContent = 'No project data found yet. Once your Action publishes /data/projects.json, this page will auto-fill.';
      grid.innerHTML = `
        <article class="card">
          <h3>Example Project</h3>
          <p>Replace with real cards loaded from JSON.</p>
          <p><span class="badge">example</span></p>
        </article>`;
    };

    // Resolve against <base>, but still work if opened from file:// locally
    const candidates = [
      toURL('data/projects.json').href,
      'data/projects.json'
    ];

    let data = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) { data = await res.json(); break; }
      } catch (_) { /* try next */ }
    }

    if (!data || !Array.isArray(data)) return renderPlaceholder();

    const publicOnly = data.filter(p => (p.visibility || 'public') === 'public');
    if (publicOnly.length === 0) return renderPlaceholder();
    if (msg) msg.remove();
    grid.innerHTML = publicOnly.map(card).join('\n');
  }

  document.addEventListener('DOMContentLoaded', loadProjects);
})();