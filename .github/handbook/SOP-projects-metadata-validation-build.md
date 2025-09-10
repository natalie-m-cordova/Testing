# Standard Operating Procedure (SOP)
**Title:** Projects Metadata, Validation & Build (docs/projects)

**Owner:** Repository Maintainer  
**Version:** 1.0  
**Effective Date:** 2025‑09‑09

---

## 1) Purpose
Define a reliable, repeatable process to add, validate, publish, and maintain project entries that drive the Projects page. This SOP standardizes metadata, prevents schema drift, and ensures only ready items are listed publicly.

## 2) Scope
Applies to all folders under `docs/projects/<slug>` and the automation that produces `data/projects.json`. Includes authoring templates, schema validation, CI build, publishing, updating, and archiving.

## 3) References
- `Templates/Project/` (authoring templates)
- `Templates/meta.schema.json` (JSON Schema for `meta.json`)
- `.github/scripts/new-project.sh` (scaffold script)
- `.github/scripts/build-projects-json.js` (validate + build)
- `.github/workflows/build-projects.yml` (CI pipeline)
- `docs/projects/_template/` (optional convenience copy; ignored by build)
- Frontend loader: `/docs/assets/js/projects.js` (renders only `visibility: "public"`)

## 4) Definitions
- **Project folder**: `docs/projects/<slug>` containing `meta.json` (+ optional `README.md`).
- **Slug**: URL‑safe, lowercase string using `[a-z0-9-]`.
- **Visibility**: `public` (renders on Projects page) or `private` (hidden; draft/archived).

## 5) Roles & Responsibilities
- **Contributors**: Create/update project folders and metadata; keep drafts `private` until ready.
- **Maintainers**: Review PRs, enforce schema, resolve validation errors, merge to main.

## 6) Prerequisites
- Git and GitHub access.  
- **Local tools (optional):** Git Bash (Windows) to run the scaffold script. Node/npm **not required** locally—CI runs validation+build.

## 7) Repository Layout (relevant)
```
Templates/
  Project/
    meta.json
    README.md
  meta.schema.json
.docs/
  projects/
    _template/
    <slug>/
      meta.json
      README.md (optional)
.github/
  scripts/
    new-project.sh
    build-projects-json.js
  workflows/
    build-projects.yml
data/
  projects.json  (generated)
```

## 8) Metadata Schema (summary)
`meta.json` must follow `Templates/meta.schema.json`:
- **Required:** `title` (≤120), `summary` (≤300), `tags` (≤12, each `^[a-z0-9][a-z0-9-]*$`), `visibility` (`public|private`), `createdAt` (YYYY‑MM‑DD)
- **Optional:** `updatedAt` (date, ≥ `createdAt`), `link` (URI), `repo` (URI)

## 9) Procedure
### 9.1 Add a New Project (Draft)
1. **Create a branch**
   ```bash
   git checkout -b feat/project-<slug>
   ```
2. **Scaffold** (Windows: run from *Git Bash*):
   ```bash
   bash .github/scripts/new-project.sh <slug>
   ```
   - Script copies `Templates/Project/*` → `docs/projects/<slug>/`.
   - Auto‑stamps `createdAt`/`updatedAt` with today and sets `visibility` to `private`.
3. **Edit `meta.json`**: fill `title`, `summary`, `tags`, optional `link`/`repo`.
4. **(Optional) Edit `README.md`**: capture features, to‑dos, notes.
5. **Commit & push**:
   ```bash
   git add docs/projects/<slug>
   git commit -m "feat(project): add <slug> (private draft)"
   git push -u origin HEAD
   ```

### 9.2 Validate & Build (CI)
- Open/Update a PR. The workflow **Validate & Build Projects JSON** runs:
  - Validates every `meta.json` against `Templates/meta.schema.json`.
  - Verifies `updatedAt ≥ createdAt` if both present.
  - If all valid, generates `data/projects.json` (but only commits on push to `main`).
- **If validation fails**: the Action logs readable errors. Fix files and push again.

### 9.3 Publish (Make Project Visible)
1. Edit `docs/projects/<slug>/meta.json`: set `"visibility": "public"`.
2. Update `updatedAt` to today (recommended).
3. Commit & merge. On push to `main`, CI writes updated `data/projects.json`.
4. The Projects page will display the new item after the site updates.

### 9.4 Update an Existing Project
- Modify fields in `meta.json` (e.g., `summary`, `tags`, `link`, `repo`) and bump `updatedAt`.
- Commit → PR → merge. CI re‑generates `data/projects.json`.

### 9.5 Archive or Remove a Project
- **Archive (preferred):** set `visibility` to `private` (keeps history; hides from site).
- **Remove:** delete `docs/projects/<slug>/` and commit. CI rebuilds `projects.json`.

## 10) Branch & PR Guidelines
- Use conventional commits where possible (`feat`, `chore`, `fix`).
- Keep project add/update in a focused PR.
- Ensure CI status **green** before requesting review.

## 11) Operational Notes
- Folders starting with `_` or `.` are ignored by the builder (e.g., `docs/projects/_template/`).
- Frontend renders **only** entries with `visibility: "public"` from `data/projects.json`.
- You do **not** need npm locally; CI performs validation and build.

## 12) Troubleshooting
- **Schema errors** on PR:
  - Check required fields.
  - Ensure `tags` use lowercase letters/digits/hyphens and are unique.
  - Validate dates: `YYYY‑MM‑DD`. If both set, `updatedAt` must be ≥ `createdAt`.
  - Verify `link`/`repo` are full URIs (e.g., `https://…`).
- **Project not appearing on site**:
  - Confirm `visibility: "public"`.
  - Verify `data/projects.json` changed in the last run.
  - Hard refresh the page (cache).
- **Windows cannot run Bash**: Install Git Bash or run the scaffold manually (create folder + copy templates) and edit `meta.json`.

## 13) Change Control
- Schema updates require PRs that modify both `Templates/meta.schema.json` and any affected builder logic. Increment SOP version and note changes below.

## 14) Security & Privacy
- Keep drafts and sensitive work `private` until cleared for publication.
- Only include public links in `link`/`repo` unless the repo is intentionally public.

## 15) Acceptance Checklist (for PRs)
- [ ] `meta.json` passes schema in CI.
- [ ] `updatedAt` set (and ≥ `createdAt`).
- [ ] `visibility` correctly set (`private` for drafts, `public` to publish).
- [ ] Tags are concise (≤ 8 preferred) and valid.
- [ ] Optional `README.md` updated (features / to‑dos).

---

### Appendix A — Sample `meta.json` (public)
```json
{
  "title": "My Awesome App",
  "summary": "A tiny demo that showcases the new components.",
  "tags": ["web", "ui", "demo"],
  "visibility": "public",
  "createdAt": "2025-09-01",
  "updatedAt": "2025-09-09",
  "link": "https://example.com/app",
  "repo": "https://github.com/org/repo"
}
```

### Appendix B — Minimal Workflow Behavior
- On PR: validate; fail fast on schema errors; do **not** commit `data/projects.json`.
- On push to `main`: validate; build; commit `data/projects.json` if changed.

### Appendix C — Slug Guidelines
- Lowercase; hyphen‑separated words; only `[a-z0-9-]`.
- Examples: `portfolio-graph`, `ansible-hardening`, `stp-approval-pipeline`.

---
**End of SOP**



---

## 16) File Snippets & Screenshots (Source of Truth)
Below are live snippets of the files referenced in this SOP. If any file isn’t yet committed in your repo, keep these blocks as **placeholders** until merged.

### 16.1 `Templates/meta.schema.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/project-meta.schema.json",
  "title": "Project Metadata",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "summary", "tags", "visibility", "createdAt"],
  "properties": {
    "title":   { "type": "string", "minLength": 1, "maxLength": 120 },
    "summary": { "type": "string", "minLength": 1, "maxLength": 300 },
    "tags": {
      "type": "array",
      "items": { "type": "string", "minLength": 1, "maxLength": 24, "pattern": "^[a-z0-9][a-z0-9-]*$" },
      "uniqueItems": true,
      "maxItems": 12
    },
    "visibility": { "type": "string", "enum": ["public", "private"] },
    "createdAt":  { "type": "string", "format": "date" },
    "updatedAt":  { "type": "string", "format": "date" },
    "link":       { "type": "string", "format": "uri", "maxLength": 2048 },
    "repo":       { "type": "string", "format": "uri", "maxLength": 2048 }
  }
}
```

### 16.2 `.github/scripts/build-projects-json.js` (validate **then** build)
```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ROOT = process.cwd();
const PROJECTS_DIR = path.join(ROOT, 'docs', 'projects');
const SCHEMA_FILE  = path.join(ROOT, 'Templates', 'meta.schema.json');
const OUT_DIR      = path.join(ROOT, 'data');
const OUT_FILE     = path.join(OUT_DIR, 'projects.json');

function readJson(p){ try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function listDirs(dir){ if(!fs.existsSync(dir)) return []; return fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()&&!d.name.startsWith('_')&&!d.name.startsWith('.')).map(d=>d.name); }
function parseDateStr(s){ const t = Date.parse(String(s||'')); return Number.isFinite(t) ? t : NaN; }

(function main(){
  const schema = readJson(SCHEMA_FILE);
  if(!schema){ console.error(`❌ Missing or invalid schema at ${path.relative(ROOT, SCHEMA_FILE)}`); process.exit(1); }
  const ajv = new Ajv({ allErrors:true, strict:false }); addFormats(ajv); const validate = ajv.compile(schema);

  const slugs = listDirs(PROJECTS_DIR);
  const errors = []; const records = [];
  for(const slug of slugs){
    const metaPath = path.join(PROJECTS_DIR, slug, 'meta.json');
    const meta = readJson(metaPath);
    if(!meta){ errors.push(`[${slug}] Missing or invalid JSON: ${path.relative(ROOT, metaPath)}`); continue; }
    const ok = validate(meta);
    if(!ok){ const msgs = (validate.errors||[]).map(e=>`  - ${e.instancePath||'/'} ${e.message}`); errors.push(`[${slug}] Schema errors:
${msgs.join('
')}`); continue; }
    if(meta.createdAt && meta.updatedAt){
      const c = parseDateStr(meta.createdAt); const u = parseDateStr(meta.updatedAt);
      if(Number.isFinite(c) && Number.isFinite(u) && u < c){ errors.push(`[${slug}] updatedAt (${meta.updatedAt}) must be >= createdAt (${meta.createdAt}).`); continue; }
    }
    records.push({ slug, title: meta.title||'Untitled Project', summary: meta.summary||'', tags: Array.isArray(meta.tags)?meta.tags:[], visibility: (meta.visibility||'public'), createdAt: meta.createdAt||'', updatedAt: meta.updatedAt||meta.createdAt||'', link: meta.link||'', repo: meta.repo||'' });
  }

  if(errors.length){ console.error(`
❌ Validation failed (${errors.length}):
${errors.map(e=>' - '+e).join('
')}
`); process.exit(1); }

  records.sort((a,b)=>{ const ad = parseDateStr(a.updatedAt||a.createdAt||0); const bd = parseDateStr(b.updatedAt||b.createdAt||0); return bd - ad; });
  fs.mkdirSync(OUT_DIR,{recursive:true}); fs.writeFileSync(OUT_FILE, JSON.stringify(records, null, 2)+'
','utf8');
  console.log(`✅ Validated ${slugs.length} project(s); wrote ${records.length} → ${path.relative(ROOT, OUT_FILE)}`);
})();
```

### 16.3 `.github/workflows/build-projects.yml`
```yaml
name: Validate & Build Projects JSON

on:
  pull_request:
    paths:
      - 'docs/projects/**/meta.json'
      - 'Templates/meta.schema.json'
      - '.github/scripts/build-projects-json.js'
  push:
    branches: [ main ]
    paths:
      - 'docs/projects/**'
      - 'Templates/meta.schema.json'
      - '.github/scripts/build-projects-json.js'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps (ajv + formats)
        run: npm i --no-save ajv@^8 ajv-formats@^3
      - name: Validate then Build projects.json
        run: node .github/scripts/build-projects-json.js
      - name: Commit updated data/projects.json
        if: github.ref == 'refs/heads/main'
        run: |
          if [[ -n "$(git status --porcelain data/projects.json)" ]]; then
            git config user.name  "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add data/projects.json
            git commit -m "chore(data): update projects.json"
            git push
          else
            echo "No changes to commit."
          fi
```

### 16.4 `.github/scripts/new-project.sh` (scaffold)
```bash
#!/usr/bin/env bash
set -euo pipefail
SLUG="${1:-}"; [[ -z "$SLUG" ]] && { echo "Usage: $0 <slug>"; exit 1; }
# normalize slug
norm="$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-|-$//g')"; [[ "$norm" != "$SLUG" ]] && { echo "→ normalized: $norm"; SLUG="$norm"; }
SRC="Templates/Project"; DEST="docs/projects/$SLUG"
[[ -d "$SRC" ]] || { echo "Missing $SRC"; exit 1; }
[[ -e "$DEST" ]] && { echo "Already exists: $DEST"; exit 1; }
mkdir -p "$DEST"; cp "$SRC/meta.json" "$DEST/meta.json"; cp "$SRC/README.md" "$DEST/README.md"
# stamp dates; keep private by default
TODAY=$(date +%F)
if command -v jq >/dev/null 2>&1; then
  tmp=$(mktemp)
  jq --arg d "$TODAY" '.createdAt=$d | .updatedAt=$d | .visibility="private"' "$DEST/meta.json" > "$tmp" && mv "$tmp" "$DEST/meta.json"
else
  sed -i.bak "s/\"createdAt\": *\"[^\"]*\"/\"createdAt\": \"$TODAY\"/; s/\"updatedAt\": *\"[^\"]*\"/\"updatedAt\": \"$TODAY\"/" "$DEST/meta.json" && rm -f "$DEST/meta.json.bak"
fi
printf "✅ Created %s
   - meta.json (visibility=private)
   - README.md
" "$DEST"
```

### 16.5 Frontend loader (excerpt of `projects.js`)
```js
const dataUrl = base + 'data/projects.json';
// ...
const items = Array.isArray(data) ? data : Array.isArray(data.projects) ? data.projects : [];
const visible = items.filter(p => (p.visibility || 'public').toLowerCase() === 'public');
// ...
visible.sort((a, b) => {
  const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return bd - ad; // newest first
});
```
> Note: ensure your HTML has `#projects-grid` and `#projects-status` IDs as expected by the loader.

### 16.6 Screenshots (placeholders — replace with real images)
- **[PLACEHOLDER]** Screenshot: GitHub Actions run — *success* (Validate & Build Projects JSON).  
  *(Insert image of green check run here)*
- **[PLACEHOLDER]** Screenshot: GitHub Actions run — *failure with schema error*.  
  *(Insert image of red X run with log section expanded)*
- **[PLACEHOLDER]** Screenshot: Projects page before/after publishing a project.  
  *(Insert image showing hidden draft vs visible entry after `visibility: public`)*

---

## 17) CI Logs — Expected Output
These are exact strings produced by the combined validator+builder script.

### 17.1 Success (PR or push) — validation passes
```text
✅ Validated <N> project(s); wrote <M> → data/projects.json
```

### 17.2 Failure — schema errors
```text
❌ Validation failed (2):
 - [ansible-hardening] Schema errors:
   - /tags/0 must match pattern "^[a-z0-9][a-z0-9-]*$"
 - [portfolio-graph] Schema errors:
   - /summary must NOT have fewer than 1 characters
```

### 17.3 Failure — date order
```text
❌ Validation failed (1):
 - [cool-tool] updatedAt (2025-01-01) must be >= createdAt (2025-02-01).
```

### 17.4 Failure — invalid JSON
```text
❌ Validation failed (1):
 - [my-project] Missing or invalid JSON: docs/projects/my-project/meta.json
```

> On **push to `main`**, a successful run may also log `chore(data): update projects.json` commit output from the workflow’s commit step.

---

## 18) Troubleshooting — Playbook
**Symptom:** *Workflow didn’t trigger.*  
**Check:** PR changes must match workflow `paths:` filters (e.g., `docs/projects/**/meta.json`). If you created only `README.md`, the job won’t run.

**Symptom:** *Schema validation failed.*  
**Check:**
- Required fields present (`title`, `summary`, `tags`, `visibility`, `createdAt`).
- `tags` are lowercase, alphanumeric with hyphens; unique; ≤12 items (≤8 recommended).
- Dates are `YYYY-MM-DD`; ensure `updatedAt ≥ createdAt` when both set.
- `link`/`repo` are full URLs (start with `http://` or `https://`).

**Symptom:** *Project doesn’t appear on Projects page.*  
**Check:**
- `visibility` is exactly `"public"` in `meta.json`.
- CI committed a fresh `data/projects.json` on `main` (check workflow logs and commit history).
- Browser cache: hard refresh the page.

**Symptom:** *Windows can’t run Bash scaffold.*  
**Workaround:** Use Git Bash; or manually create `docs/projects/<slug>/` and copy from `Templates/Project/`. The CI will still validate/build.

**Symptom:** *URI format errors for `link`/`repo`.*  
**Check:** Include the scheme (e.g., `https://github.com/...`). Avoid relative paths in metadata; use absolute URLs only.

**If additional errors occur**: capture the workflow URL and attach a screenshot under Section 16.6 placeholders.

---

## 19) Operational Examples (Fill with real runs)
- **[PLACEHOLDER]** PR #<number>: `feat(project): add <slug> (private draft)` — CI result, link, and notes.
- **[PLACEHOLDER]** Push to `main`: `chore(data): update projects.json` — commit link and diff summary.

---
**End of Addendum**

