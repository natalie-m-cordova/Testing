// scripts/render-md.js
// Replaces placeholders in markdown files with repo metadata from GitHub Actions.
// Supported placeholders: ${REPO_OWNER}, ${REPO_NAME}, ${REPO_SLUG}, ${REPO_URL}, ${OWNER_URL}
//
// Usage (in CI): `node scripts/render-readme.js`
// - Prefers README.template.md if present; otherwise uses README.md as the template.
// - Writes result to README.md.
// - Idempotent: if no changes, it still exits 0.

const fs = require('fs');
const path = require('path');

function getRepoInfo() {
  const full = process.env.GITHUB_REPOSITORY || ''; // "owner/repo"
  const [owner, repo] = full.split('/');
  const slug = full;
  const repoUrl = owner && repo ? `https://github.com/${owner}/${repo}` : '';
  const ownerUrl = owner ? `https://github.com/${owner}` : '';
  return { owner, repo, slug, repoUrl, ownerUrl };
}

function readTemplate() {
  const templatePath = fs.existsSync('README.template.md')
    ? 'README.template.md'
    : 'README.md';

  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Could not find README.md or README.template.md`);
    process.exit(1);
  }

  return { template: fs.readFileSync(templatePath, 'utf8'), templatePath };
}

function render(src, vars) {
  // Replace ${VAR} style tokens; keep it simple & explicit
  return src
    .replaceAll('${REPO_OWNER}', vars.owner || '')
    .replaceAll('${REPO_NAME}',  vars.repo  || '')
    .replaceAll('${REPO_SLUG}',  vars.slug  || '')
    .replaceAll('${REPO_URL}',   vars.repoUrl  || '')
    .replaceAll('${OWNER_URL}',  vars.ownerUrl || '');
}

(function main () {
  const { owner, repo, slug, repoUrl, ownerUrl } = getRepoInfo();
  if (!owner || !repo) {
    console.warn('⚠️ GITHUB_REPOSITORY is not set (owner/repo). Rendering may be incomplete.');
  }

  const { template, templatePath } = readTemplate();
  const out = render(template, { owner, repo, slug, repoUrl, ownerUrl });

  // Always write to README.md
  const outPath = path.resolve('README.md');

  // Only write if different to avoid unnecessary commits
  const prev = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (prev === out) {
    console.log('ℹ️ README.md already up to date. No changes.');
  } else {
    fs.writeFileSync(outPath, out, 'utf8');
    console.log(`✅ Rendered README from ${templatePath} -> README.md`);
  }
})();