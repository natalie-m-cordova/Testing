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

const LAYOUT = (process.env.WIKI_LAYOUT_MODE || "flat").toLowerCase(); // "flat" | "folders"

const octokit = new MyOctokit({ auth: TOKEN });

const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0,10) : "—");
const esc = (s) => String(s || "").replace(/\r?\n/g, " ").trim();
const sprintBase = (title) => {
  const m = String(title || "").match(/(Sprint)\s*#?\s*(\d+)/i);
  return m ? `Sprint ${m[2]}` : (title || "Sprint");
};
const hyphenate = (s) => String(s || "").trim().replace(/\s+/g, "-");

function replaceBetweenMarkers(src, startTag, endTag, html) {
  const re = new RegExp(`(<!--\\s*${startTag}\\s*-->)([\\s\\S]*?)(<!--\\s*${endTag}\\s*-->)`, "m");
  if (!re.test(src)) return src;
  return src.replace(re, `$1\n${html.trim()}\n$3`);
}

(async function main() {
  // fetch closed milestones (most recent first by due date)
  const closed = await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner, repo, state: "closed", sort: "due_on", direction: "desc", per_page: 100,
  });

  const latest = closed[0] || null;

  // Build link set based on layout
  let md;
  if (!latest) {
    // Fallback when nothing closed yet
    const practicesLink = (LAYOUT === "folders")
      ? "../../wiki/Practices/How-we-work"
      : "../../wiki/Practices-How-we-work";
    md = [
      "- **Latest Review:** _TBD_",
      "- **Latest Retro:** _TBD_",
      `- **How We Work:** [Practices](${practicesLink})`,
    ].join("\n");
  } else {
    const base = sprintBase(latest.title);           // e.g., "Sprint 1"
    const baseHy = hyphenate(base);                  // "Sprint-1"

    // Paths differ by layout
    const reviewPath = (LAYOUT === "folders")
      ? `../../wiki/Sprints/${baseHy}/Review`
      : `../../wiki/${baseHy}---Review`;

    const retroPath = (LAYOUT === "folders")
      ? `../../wiki/Sprints/${baseHy}/Retro`
      : `../../wiki/${baseHy}-Retro`;

    const practicesPath = (LAYOUT === "folders")
      ? "../../wiki/Practices/How-we-work"
      : "../../wiki/Practices-How-we-work";

    md = [
      `- **Latest Review:** [${base} Review](${reviewPath})`,
      `- **Latest Retro:** [${base} Retrospective](${retroPath})`,
      `- **How We Work:** [Practices](${practicesPath})`,
    ].join("\n");
  }

  const readmePath = path.resolve("README.md");
  if (!fs.existsSync(readmePath)) { console.error("❌ README.md not found."); process.exit(1); }
  const prev = fs.readFileSync(readmePath, "utf8");
  const out  = replaceBetweenMarkers(prev, "WIKI:NOTES START", "WIKI:NOTES END", md);

  if (out !== prev) {
    fs.writeFileSync(readmePath, out, "utf8");
    console.log("✅ README.md updated with Sprint Notes (Wiki).");
  } else {
    console.log("ℹ️ README.md wiki notes unchanged.");
  }
})().catch((e) => { console.error("❌ wiki-notes-to-readme.js failed:", e); process.exit(1); });
