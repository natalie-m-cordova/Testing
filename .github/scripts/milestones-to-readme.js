// .github/scripts/milestones-to-readme.js
const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");

const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.ORG_GRAPHQL_TOKEN;
if (!TOKEN) { console.error("❌ Missing token (GITHUB_TOKEN/GH_TOKEN/ORG_GRAPHQL_TOKEN)."); process.exit(1); }

const REPO_FULL = process.env.GITHUB_REPOSITORY || "";
if (!REPO_FULL.includes("/")) { console.error("❌ Missing/invalid GITHUB_REPOSITORY."); process.exit(1); }
const [owner, repo] = REPO_FULL.split("/");

const MAX_PLANNED = parseInt(process.env.MAX_PLANNED || "3", 10);
const MAX_RECENT_CLOSED = parseInt(process.env.MAX_RECENT_CLOSED || "3", 10);
const EPIC_LABELS = (process.env.EPIC_LABELS || "epic").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const SPRINT_BADGE = (process.env.SPRINT_BADGE || "").trim();

const octokit = new MyOctokit({ auth: TOKEN });

const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0,10) : "—");
const esc = (s) => String(s || "").replace(/\r?\n/g, " ").trim();
const sprintName = (ms) => {
  const m = (ms?.title || "").match(/(Sprint\s*#?\s*\d+)/i);
  return m ? m[1].replace(/\s*#\s*/i, " ") : (ms?.title || "Sprint");
};

function replaceBetweenMarkers(src, startTag, endTag, html) {
  const re = new RegExp(`(<!--\\s*${startTag}\\s*-->)([\\s\\S]*?)(<!--\\s*${endTag}\\s*-->)`, "m");
  if (!re.test(src)) return src;
  return src.replace(re, `$1\n${html.trim()}\n$3`);
}

async function listMilestones(state, sort, direction) {
  return await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner, repo, state, sort, direction, per_page: 100,
  });
}

async function listIssuesForMilestone(milestoneNumber) {
  const items = await octokit.paginate(octokit.rest.issues.listForRepo, {
    owner, repo, milestone: milestoneNumber, state: "all", per_page: 100,
  });
  return items.filter(i => !i.pull_request);
}

(async function main() {
  const open = await listMilestones("open", "due_on", "asc");
  const closed = await listMilestones("closed", "due_on", "desc");

  const current = open[0] || null;
  const planned = (current ? open.slice(1) : open).slice(0, MAX_PLANNED);
  const recentClosed = closed.slice(0, MAX_RECENT_CLOSED);

  // Current Milestone block
  let currentHTML = `<p><em>No current sprint.</em></p>`;
  if (current) {
    // EPIC issues in current milestone
    const issues = await listIssuesForMilestone(current.number);
    const epicIssues = issues.filter(i => (i.labels || []).some(l => {
      const name = typeof l === "string" ? l : l.name;
      return name && EPIC_LABELS.includes(String(name).toLowerCase());
    }));

    const epicBullets = epicIssues.length
      ? epicIssues.map(i => `- [#${i.number}](${i.html_url}) ${esc(i.title)}`).join("\n")
      : "_No EPICs tagged in this sprint._";

    currentHTML = [
      `**${esc(current.title)}** *Due: ${fmtDate(current.due_on)}*`,
      epicBullets
    ].join("\n");
  }

  // Planned table (exclude current)
  const plannedHTML = planned.length
    ? [
        `| Sprint | Due | Link |`,
        `|---|---|---|`,
        ...planned.map(ms => {
          const totalClosed = ms.closed_issues || 0;
          const totalOpen = ms.open_issues || 0;
          return `| ${esc(sprintName(ms))} | ${fmtDate(ms.due_on)} | ${totalClosed} | ${totalOpen} | [Milestone](${ms.html_url}) |`;
        })
      ].join("\n")
    : `_No additional planned sprints._`;

  // Recently Closed table
  const closedHTML = recentClosed.length
    ? [
        `| Sprint | Due | Closed | Issues (closed/total) | Link |`,
        `|---|---|---|---:|---|`,
        ...recentClosed.map(ms => {
          const closedCount = ms.closed_issues || 0;
          const total = (ms.open_issues || 0) + closedCount;
          return `| ${esc(sprintName(ms))} | ${fmtDate(ms.due_on)} | ${fmtDate(ms.closed_at)} | ${closedCount}/${total} | [Milestone](${ms.html_url}) |`;
        })
      ].join("\n")
    : `_No closed sprints yet._`;

  const readmePath = path.resolve("README.md");
  if (!fs.existsSync(readmePath)) { console.error("❌ README.md not found."); process.exit(1); }
  let src = fs.readFileSync(readmePath, "utf8");

  // Inject sections
  let out = src;
  out = replaceBetweenMarkers(out, "SPRINTS:CURRENT START", "SPRINTS:CURRENT END", currentHTML);
  out = replaceBetweenMarkers(out, "SPRINTS:PLANNED START", "SPRINTS:PLANNED END", plannedHTML);
  out = replaceBetweenMarkers(out, "SPRINTS:CLOSED START", "SPRINTS:CLOSED END", closedHTML);

  // Keep using your computed sprint badge if provided
  if (SPRINT_BADGE) {
    out = replaceBetweenMarkers(out, "SPRINT BADGE START", "SPRINT BADGE END", SPRINT_BADGE);
  }

  if (out !== src) {
    fs.writeFileSync(readmePath, out, "utf8");
    console.log("✅ README.md updated from milestones.");
  } else {
    console.log("ℹ️ README.md unchanged.");
  }
})().catch((e) => { console.error("❌ milestones-to-readme.js failed:", e); process.exit(1); });
