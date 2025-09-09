// docs/assets/js/skills.js
(function () {
  const LIST_SEL = '#skills-list';
  const GRAPH_SEL = '#skills-graph';
  const DATA_URL = '/Testing/data/skills.json'; // <-- If you rename repo, swap to relative: '../data/skills.json'

  async function loadSkills() {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Failed to load skills.json:', e.message);
      return null;
    }
  }

  function renderList(skills) {
    const mount = document.querySelector(LIST_SEL);
    if (!mount) return;

    if (!skills || !Array.isArray(skills.nodes) || skills.nodes.length === 0) {
      mount.innerHTML = '<p class="muted">No skills found yet.</p>';
      return;
    }

    // Simple, accessible list (grouped by optional "group" if present)
    const groups = new Map();
    for (const n of skills.nodes) {
      const g = (n.group || 'General').trim();
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(n);
    }

    let html = '';
    for (const [group, items] of groups) {
      html += `<h3>${escapeHtml(group)}</h3><ul>`;
      for (const n of items.sort((a,b) => (a.name || '').localeCompare(b.name || ''))) {
        const lvl = n.level != null ? ` — level ${String(n.level)}` : '';
        const tags = Array.isArray(n.tags) && n.tags.length ? ` <span class="badge">${n.tags.slice(0,3).join(' • ')}</span>` : '';
        html += `<li>${escapeHtml(n.name || 'Skill')}${lvl}${tags}</li>`;
      }
      html += '</ul>';
    }
    mount.innerHTML = html;
  }

  function renderGraphPlaceholder(skills) {
    // For now, we only replace the placeholder text if data exists.
    // Later, this is where you’ll initialize a D3 force simulation.
    const shell = document.querySelector(GRAPH_SEL);
    if (!shell) return;

    const placeholder = shell.querySelector('.graph-placeholder');
    if (!placeholder) return;

    if (skills && Array.isArray(skills.nodes) && skills.nodes.length) {
      placeholder.innerHTML = '<p>Data loaded. D3 graph coming next.</p>';
    } else {
      // keep the default placeholder text
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const data = await loadSkills();

    renderList(data);
    renderGraphPlaceholder(data);

    // --- D3 HOOK (future) ---
    // if (data && Array.isArray(data.nodes)) {
    //   const el = document.querySelector(GRAPH_SEL);
    //   // initialize d3 force layout here using data.nodes / data.edges
    // }
  });
})();