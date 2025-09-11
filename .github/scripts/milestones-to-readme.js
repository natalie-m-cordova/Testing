// .github/scripts/milestones-to-readme.js
const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");

const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

const TOKEN =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  process.env.ORG_GRAPHQL_TOKEN;

if (!TOKEN) {
  console.error("❌ Missing token (GITHUB_TOKEN/GH_TOKEN/ORG_GRAPHQL_TOKEN).");
  process.exit(1);
}

const REPO_FULL = process.env.GITHUB_REPOSITORY || "";
if (!REPO_FULL.includes("/")) {
  console.error("❌ Missing/invalid GITHUB_REPOSITORY.");
  process.exit(1);
}
const [owner, repo] = REPO_FULL.split("/");
const MAX_RECENT = parseInt(process.env.MAX_RECENT_CLOSED || "5", 10);

const SPRINT_BADGE = (process.env.SPRINT_BADGE || "").trim();

const octokit = new MyOctokit({ auth: TOKEN });

const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0, 10) : "—");
const esc = (s) => String(s || "").replace(/\r?\n/g, " ").trim();
const sprintName = (ms) => {
  const m = (ms?.title || "").match(/(Sprint\s*#?\s*\d+)/i);
  return m ? m[1].replace(/\s*#\s*/i, " ") : (ms?.title || "Sprint");
};

function replaceBetweenMarkers(src, startTag, endTag, html) {
  const re = new RegExp(
    `(<!--\\s*${startTag}\\s*-->)([\\s\\S]*?)(<!--\\s*${endTag}\\s*-->)`,
    "m"
  );
  if (!re.test(src)) return src; // no-op if markers missing
  return src.replace(re, `$1\n${html.trim()}\n$3`);
}

async function listMilestones(state, sort, direction) {
  return await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner,
    repo,
    state,
    sort,
    direction,
    per_page: 100,
  });
}

(async function main() {
  // Fetch milestones
  const open = await listMilestones("open", "due_on", "asc");
  const closed = await listMilestones("closed", "due_on", "desc");

  const current = open[0] || null;
  const recentClosed = closed.slice(0, MAX_RECENT);

  // Build sections
  const currentHTML = current
    ? [
        `<p><strong>${esc(sprintName(current))}</strong></p>`,
        `<ul>`,
        `  <li>Due: <code>${fmtDate(current.due_on)}</code></li>`,
        `  <li>Progress: ${current.closed_issues || 0} closed / ${current.open_issues || 0} open</li>`,
        `  <li>Milestone: <a href="${current.html_url}">${esc(current.title)}</a></li>`,
        `</ul>`,
      ].join("\n")
    : `<p><em>No current sprint (showing latest closed below).</em></p>`;

  const openHTML = open.length
    ? [
        `<table>`,
        `<thead><tr><th align="left">Sprint</th><th align="left">Due</th><th align="left">Closed</th><th align="left">Open</th><th align="left">Link</th></tr></thead>`,
        `<tbody>`,
        ...open.map((ms) => {
          return `<tr>
  <td>${esc(sprintName(ms))}</td>
  <td>${fmtDate(ms.due_on)}</td>
  <td>${ms.closed_issues || 0}</td>
  <td>${ms.open_issues || 0}</td>
  <td><a href="${ms.html_url}">Milestone</a></td>
</tr>`;
        }),
        `</tbody>`,
        `</table>`,
      ].join("\n")
    : `<p><em>No open sprints.</em></p>`;

  const closedHTML = recentClosed.length
    ? [
        `<table>`,
        `<thead><tr><th align="left">Sprint</th><th align="left">Due</th><th align="left">Closed At</th><th align="left">Issues (closed/total)</th><th align="left">Link</th></tr></thead>`,
        `<tbody>`,
        ...recentClosed.map((ms) => {
          const total = (ms.open_issues || 0) + (ms.closed_issues || 0);
          return `<tr>
  <td>${esc(sprintName(ms))}</td>
  <td>${fmtDate(ms.due_on)}</td>
  <td>${fmtDate(ms.closed_at)}</td>
  <td>${(ms.closed_issues || 0)}/${total}</td>
  <td><a href="${ms.html_url}">Milestone</a></td>
</tr>`;
        }),
        `</tbody>`,
        `</table>`,
      ].join("\n")
    : `<p><em>No closed sprints yet.</em></p>`;

  const readmePath = path.resolve("README.md");
  if (!fs.existsSync(readmePath)) {
    console.error("❌ README.md not found.");
    process.exit(1);
  }

  let src = fs.readFileSync(readmePath, "utf8");

  // Inject sections
  let out = src;
  out = replaceBetweenMarkers(out, "SPRINTS:CURRENT START", "SPRINTS:CURRENT END", currentHTML);
  out = replaceBetweenMarkers(out, "SPRINTS:OPEN START", "SPRINTS:OPEN END", openHTML);
  out = replaceBetweenMarkers(out, "SPRINTS:CLOSED START", "SPRINTS:CLOSED END", closedHTML);

  // Inject sprint badge if provided
  if (SPRINT_BADGE) {
    out = replaceBetweenMarkers(out, "SPRINT BADGE START", "SPRINT BADGE END", SPRINT_BADGE);
  }

  if (out !== src) {
    fs.writeFileSync(readmePath, out, "utf8");
    console.log("✅ README.md updated from milestones.");
  } else {
    console.log("ℹ️ README.md unchanged.");
  }
})().catch((e) => {
  console.error("❌ milestones-to-readme.js failed:", e);
  process.exit(1);
});
