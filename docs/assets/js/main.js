(function () {
  // ---------- Helpers ----------
  function trimSlash(s) { return s.replace(/\/+$/, ''); }
  function firstPathSeg() {
    const segs = location.pathname.split('/').filter(Boolean);
    return segs.length ? segs[0] : '';
  }
  // On GitHub Pages, path is /<user>.github.io/<repo>/...
  // repoRoot becomes '/Testing' for this repo; '' for localhost or custom hosts.
  const repoRoot = (location.hostname.endsWith('github.io') ? `/${firstPathSeg()}` : '');

  function resolvePath(p) {
    // always return repo-rooted absolute path like '/Testing/projects/'
    if (p.startsWith('http')) return p;
    const clean = p.startsWith('/') ? p : '/' + p.replace(/^\.{1,2}\//, '');
    return repoRoot + clean;
  }

  // ---------- Mark active nav link ----------
  const here = trimSlash(location.pathname);
  document.querySelectorAll('a[data-nav]').forEach(a => {
    // Normalize hrefs to work on Pages
    const raw = a.getAttribute('href') || '';
    // Leave absolute http(s) links alone
    if (!/^https?:\/\//i.test(raw)) {
      const fixed = resolvePath(raw);
      a.setAttribute('href', fixed);
    }
    const href = trimSlash(a.getAttribute('href'));
    // active if URL ends with link path, or link points to '/.../index.html' variant
    if (href && (here.endsWith(href) || (href.endsWith('/index.html') && here.endsWith(href.replace('/index.html',''))))) {
      a.classList.add('active');
    }
  });

  // ---------- Footer year & source link ----------
  document.addEventListener('DOMContentLoaded', () => {
    const y = document.getElementById('y');
    if (y) y.textContent = new Date().getFullYear();

    const src = document.getElementById('srcLink');
    if (src) {
      // Try to infer "owner/repo" from hostname + path on Pages
      // e.g. https://natalie-m-cordova.github.io/Testing/...
      const segs = location.pathname.split('/').filter(Boolean);
      const repo = (location.hostname.endsWith('github.io') && segs.length >= 1) ? segs[0] : 'Testing';
      // If you rename the repo, this keeps working on Pages automatically
      // (owner inferred from hostname, repo from first path segment)
      const owner = location.hostname.replace('.github.io','');
      src.href = `https://github.com/${owner}/${repo}`;
    }
  });

  // ---------- Projects loader ----------
  async function loadProjects() {
    const grid = document.getElementById('projectsGrid');
    const msg  = document.getElementById('projectsMsg');
    if (!grid) return;

    // Helper to render a single card
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

    // If JSON isn’t there yet, render a friendly placeholder and bail
    function renderPlaceholder() {
      if (msg) msg.textContent = 'No project data found yet. Once your Action commits /data/projects.json, this page will auto-fill.';
      grid.innerHTML = `
        <article class="card">
          <h3>Example Project</h3>
          <p>Replace with real cards loaded from JSON.</p>
          <p><span class="badge">example</span></p>
        </article>`;
    }

    // Try both absolute (Pages) and relative (local dev) locations
    const candidates = [
      resolvePath('/data/projects.json'),
      '../data/projects.json',
      './data/projects.json'
    ];

    let data = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch (_) { /* try next */ }
    }

    if (!data || !Array.isArray(data)) {
      renderPlaceholder();
      return;
    }

    // Filter out private by default for the public page
    const publicOnly = data.filter(p => (p.visibility || 'public') === 'public');

    if (publicOnly.length === 0) {
      renderPlaceholder();
      return;
    }

    if (msg) msg.remove();
    grid.innerHTML = publicOnly.map(card).join('\n');
  }

  document.addEventListener('DOMContentLoaded', loadProjects);
})();