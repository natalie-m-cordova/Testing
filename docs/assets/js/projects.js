(function () {
  function detectBase() {
    const host = location.hostname;
    const parts = location.pathname.split('/').filter(Boolean);
    if (host.endsWith('github.io') && parts.length > 0) return '/' + parts[0] + '/';
    return '/';
  }
  const base = detectBase();
  const dataUrl = base + 'data/projects.json';

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#projects-grid');
  const status = $('#projects-status');

  const sortRadios = () => Array.from(document.querySelectorAll('input[name="sort"]'));
  const sortValue = () => (sortRadios().find(r => r.checked)?.value) || 'date';

  function clearStatus(){ if (status){ status.textContent = ''; status.hidden = true; } }
  function showStatus(msg){ if (status){ status.hidden = false; status.textContent = msg; } }

  function badge(text){
    const span = document.createElement('span');
    span.className = 'badge';
    span.textContent = text;
    return span;
  }

  function projectHref(p) {
    // Internal page if we have a slug: /<base>/projects/<slug>/
    if (p.slug) return base + 'projects/' + p.slug + '/';
    // Otherwise fall back to external link if available
    if (p.link) return p.link;
    return null;
  }

  function projectCard(p) {
    const article = document.createElement('article');
    article.className = 'card';

    const h3 = document.createElement('h3');
    const to = projectHref(p);
    if (to) {
      const a = document.createElement('a');
      a.href = to;
      a.rel = 'noopener';
      if (!to.startsWith(base)) { a.target = '_blank'; } // external link
      a.textContent = p.title || 'Untitled Project';
      h3.appendChild(a);
    } else {
      h3.textContent = p.title || 'Untitled Project';
    }

    const desc = document.createElement('p');
    desc.textContent = p.summary || 'No description provided.';

    const meta = document.createElement('p');
    meta.style.marginTop = '8px';

    const dateText = (p.updatedAt || p.createdAt || '').slice(0,10) || 'n/a';
    meta.appendChild(badge(dateText));

    // show up to 4 tags
    if (Array.isArray(p.tags)) {
      p.tags.slice(0, 4).forEach(t => {
        const b = badge(t);
        b.style.marginLeft = '6px';
        meta.appendChild(b);
      });
    }

    if (typeof p.rating === 'number') {
      const b = badge(`★ ${p.rating.toFixed(1)}`);
      b.style.marginLeft = '6px';
      meta.appendChild(b);
    }

    // repo link (optional)
    const links = document.createElement('p');
    links.style.marginTop = '6px';
    if (p.repo) {
      const a = document.createElement('a');
      a.href = p.repo;
      a.textContent = 'Repository';
      a.target = '_blank';
      a.rel = 'noopener';
      links.appendChild(a);
    }

    article.append(h3, desc, meta, links);
    return article;
  }

  function sortItems(items, mode) {
    if (mode === 'rating') {
      // Higher rating first; tie-break by updatedAt/createdAt desc
      return items.slice().sort((a, b) => {
        const ar = (typeof a.rating === 'number') ? a.rating : -Infinity;
        const br = (typeof b.rating === 'number') ? b.rating : -Infinity;
        if (br !== ar) return br - ar;
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });
    }
    // default: date (updatedAt/createdAt desc)
    return items.slice().sort((a, b) => {
      const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    });
  }

  let cached = [];

  function render() {
    if (!grid) return;
    const mode = sortValue();
    const visible = cached.filter(p => (p.visibility || 'public').toLowerCase() === 'public');
    if (visible.length === 0) { showStatus('No public projects yet.'); return; }
    clearStatus();
    grid.hidden = false;
    grid.innerHTML = '';
    const sorted = sortItems(visible, mode);
    sorted.forEach(p => grid.appendChild(projectCard(p)));
  }

  async function load() {
    try {
      const res = await fetch(dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cached = Array.isArray(data) ? data : Array.isArray(data.projects) ? data.projects : [];
      render();
    } catch (err) {
      console.error('Failed to load projects.json:', err);
      showStatus('Could not load project list yet. Try again later.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    sortRadios().forEach(r => r.addEventListener('change', render));
  });
})();