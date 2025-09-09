(function () {
  // Figure out the base path for GitHub Pages (project site vs user site)
  // e.g. https://<user>.github.io/<repo>/ -> base="/<repo>/"
  //      custom domain or user site     -> base="/"
  function detectBase() {
    const host = location.hostname;
    const parts = location.pathname.split('/').filter(Boolean);
    if (host.endsWith('github.io') && parts.length > 0) {
      // On a project page, the first segment is the repo name when served from /<repo>/...
      return '/' + parts[0] + '/';
    }
    return '/';
  }

  const base = detectBase();

  // Where the Action will commit the data
  const dataUrl = base + 'data/projects.json';

  // Minimal DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#projects-grid');
  const status = $('#projects-status');

  function clearStatus() {
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
  }

  function showStatus(msg) {
    if (status) {
      status.hidden = false;
      status.textContent = msg;
    }
  }

  function createBadge(text) {
    const span = document.createElement('span');
    span.className = 'badge';
    span.textContent = text;
    return span;
  }

  function projectCard(p) {
    const article = document.createElement('article');
    article.className = 'card';

    const h3 = document.createElement('h3');
    // Title with optional external link
    if (p.link) {
      const a = document.createElement('a');
      a.href = p.link;
      a.rel = 'noopener';
      a.target = '_blank';
      a.textContent = p.title || 'Untitled Project';
      h3.appendChild(a);
    } else {
      h3.textContent = p.title || 'Untitled Project';
    }

    const desc = document.createElement('p');
    desc.textContent = p.summary || 'No description provided.';

    const meta = document.createElement('p');
    meta.style.marginTop = '8px';
    meta.appendChild(createBadge((p.updatedAt || p.createdAt || '').slice(0, 10) || 'n/a'));
    if (Array.isArray(p.tags)) {
      p.tags.slice(0, 4).forEach(t => {
        const b = createBadge(t);
        b.style.marginLeft = '6px';
        meta.appendChild(b);
      });
    }
    if (p.repo) {
      const repoP = document.createElement('p');
      const a = document.createElement('a');
      a.href = p.repo;
      a.textContent = 'Repository';
      a.target = '_blank';
      a.rel = 'noopener';
      repoP.appendChild(a);
      repoP.style.marginTop = '6px';
      article.append(h3, desc, meta, repoP);
    } else {
      article.append(h3, desc, meta);
    }

    return article;
  }

  async function loadProjects() {
    try {
      const res = await fetch(dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Accept either { projects: [...] } or a raw array [...]
      const items = Array.isArray(data) ? data : Array.isArray(data.projects) ? data.projects : [];

      // Filter to public (visibility not provided defaults to public)
      const visible = items.filter(p => (p.visibility || 'public').toLowerCase() === 'public');

      if (visible.length === 0) {
        showStatus('No public projects yet.');
        return;
      }

      // Sort by updatedAt desc, fallback createdAt
      visible.sort((a, b) => {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
        });

      // Render
      clearStatus();
      grid.hidden = false;
      grid.innerHTML = ''; // clear placeholders if any

      visible.forEach(p => grid.appendChild(projectCard(p)));
    } catch (err) {
      console.error('Failed to load projects.json:', err);
      showStatus('Could not load project list yet. Try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', loadProjects);
})();