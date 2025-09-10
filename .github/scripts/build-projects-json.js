#!/usr/bin/env node

//  Validate docs/projects/*/meta.json against Templates/meta.schema.json
//  and, if valid, emit data/projects.json for the site.
// 
//  - Skips folders starting with "_" or "."
//  - On any validation error, exits 1 (no file is written)
 
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = process.cwd();
const PROJECTS_DIR = path.join(ROOT, 'docs', 'projects');
const SCHEMA_FILE  = path.join(ROOT, 'Templates', 'meta.schema.json');
const OUT_DIR      = path.join(ROOT, 'data');
const OUT_FILE     = path.join(OUT_DIR, 'projects.json');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}
function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
    .map(d => d.name);
}
function parseDateStr(s) {
  const t = Date.parse(String(s || ''));
  return Number.isFinite(t) ? t : NaN;
}

(function main() {
  const schema = readJson(SCHEMA_FILE);
  if (!schema) {
    console.error(`❌ Missing or invalid schema at ${path.relative(ROOT, SCHEMA_FILE)}`);
    process.exit(1);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const slugs = listDirs(PROJECTS_DIR);
  const errors = [];
  const records = [];

  for (const slug of slugs) {
    const metaPath = path.join(PROJECTS_DIR, slug, 'meta.json');
    const meta = readJson(metaPath);
    if (!meta) {
      errors.push(`[${slug}] Missing or invalid JSON: ${path.relative(ROOT, metaPath)}`);
      continue;
    }

    // Schema validation
    const ok = validate(meta);
    if (!ok) {
      const msgs = (validate.errors || []).map(e => `  - ${e.instancePath || '/'} ${e.message}`);
      errors.push(`[${slug}] Schema errors:\n${msgs.join('\n')}`);
      continue;
    }

    // Cross-field invariant: updatedAt >= createdAt (if both provided)
    if (meta.createdAt && meta.updatedAt) {
      const c = parseDateStr(meta.createdAt);
      const u = parseDateStr(meta.updatedAt);
      if (Number.isFinite(c) && Number.isFinite(u) && u < c) {
        errors.push(`[${slug}] updatedAt (${meta.updatedAt}) must be >= createdAt (${meta.createdAt}).`);
        continue;
      }
    }

    // Normalize the record stored in projects.json (includes private too)
    records.push({
      slug,
      title: meta.title || 'Untitled Project',
      summary: meta.summary || '',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      visibility: (meta.visibility || 'public'),
      createdAt: meta.createdAt || '',
      updatedAt: meta.updatedAt || meta.createdAt || '',
      link: meta.link || '',
      repo: meta.repo || '',
    });
  }

  if (errors.length) {
    console.error(`\n❌ Validation failed (${errors.length}):\n${errors.map(e => ' - ' + e).join('\n')}\n`);
    process.exit(1);
  }

  // Sort newest first
  records.sort((a, b) => {
    const ad = parseDateStr(a.updatedAt || a.createdAt || 0);
    const bd = parseDateStr(b.updatedAt || b.createdAt || 0);
    return bd - ad;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(records, null, 2) + '\n', 'utf8');
  console.log(`✅ Validated ${slugs.length} project(s); wrote ${records.length} → ${path.relative(ROOT, OUT_FILE)}`);
})();