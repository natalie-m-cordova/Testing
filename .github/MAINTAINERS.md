# GitHub Org & Repo Playbook

## Files & Locations
- Issue forms → `.github/ISSUE_TEMPLATE/*.yml`
  - Order by **filename**: `epic.yml`, `bug_report.yml`, etc.
- Config for issue chooser → `.github/ISSUE_TEMPLATE/config.yml`
  - Controls **blank issues** and **contact links**.
- CODEOWNERS → `.github/CODEOWNERS`
- Auto-assign workflow → `.github/workflows/auto-assign.yml`

## Labels Used
`bug`, `documentation`, `duplicate`, `enhancement`, `epic`

## Org & Teams (example)
- `core-team` (parent): maintain org-wide, triage epics
- `dev-team`: code, features, bugs
- `docs-team`: all markdown/docs
- `security-team` (secret): security policy, disclosures
- `infra-team`: CI/CD, runners, workflows

## Roles (least-privilege defaults)
- **You**: All-repo **admin**, **Apps manager**, **CI/CD admin**, **Security manager**
- `core-team`: All-repo **maintain**, **Security manager**
- `dev-team`: All-repo **write** + **triage**
- `docs-team`: All-repo **write**
- `security-team`: All-repo **write**, **Security manager**
- `infra-team`: All-repo **write**, **CI/CD admin**

> CODEOWNERS teams must have **Write** on the repo if they appear in CODEOWNERS.

---

## CODEOWNERS (belt + suspenders)
- Put **your personal @username** as **global fallback**:
  ```
  * @NMRCDova
  ```
- Then team ownerships (last match wins):
  ```
  /src/                    @natalie-m-cordova/dev-team
  *.md                     @natalie-m-cordova/docs-team
  /SECURITY.md             @natalie-m-cordova/security-team
  /.github/workflows/      @natalie-m-cordova/infra-team
  ```
- If you want `non-writable-team` notified but **not** write access:
  - Keep `core-team` (Write) as owner of `/directory`
  - Add a PR workflow to **request non-writable-team review**

**Enforce**: Settings → Branches → Branch rule `main` → ✅ Require PRs, ✅ Require review from Code Owners.

---

## Issues: Auto-Assign + Team Notify
- **Issues cannot be assigned to teams**, only users.
- Workflow pattern:
  - Always assign **DEFAULT_ASSIGNEE** (you)
  - Comment to **@org/team** based on label

**Test plan**
1) Open issue with no labels → assigned to you; comment nudges for label
2) Add `documentation` → comment pings `@org/docs-team`
3) Open with `bug` → assigns you; comment pings `@org/dev-team`

---

## Projects (grouping epics + subtasks)
- Add Project **custom field**: `Epic` (Text or Single-select)
- Set each child issue’s `Epic` to the EPIC title/number
- **Group by → Epic** on the board for a “nested” view
- Inside EPIC:
  - Use **Sub-issues** (sidebar) for formal links
  - Also add a **task list** for visible progress:
    ```
    - [ ] #123 README
    - [ ] #124 SECURITY
    - [ ] #125 LICENSE
    ```

---

## EPIC Template & Usage
- Template: `epic.yml` with fields for Summary, Problem, Scope, Acceptance, Child Issues, etc.
- Title format: `[EPIC] <name>`
- Label: `epic`
- Link child issues in **Sub-issues** and in **task list**.

---

## New Issue chooser
- Ordering: **by filename**.
- Example `config.yml`:
  ```yaml
  blank_issues_enabled: false
  contact_links:
    - name: 💬 Start a Discussion
      url: https://github.com/<org>/<repo>/discussions
      about: Use Discussions for open-ended ideas or questions.
  ```