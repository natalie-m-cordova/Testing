/**
 * updateContributors.js
 *
 * Fetch contributors, compute last-12-month activity (commits + issues/PRs created),
 * and update README.md and CONTRIBUTING.md between markers:
 *   <!-- CONTRIBUTORS:START --> ... <!-- CONTRIBUTORS:END -->
 *   <!-- PREVIOUS-CONTRIBUTORS:START --> ... <!-- PREVIOUS-CONTRIBUTORS:END -->
 *   <!-- PREV-BLOCK:START --> ... <!-- PREV-BLOCK:END -->   (wrapper to hide whole section when empty)
 *
 * Expects environment:
 *   - GITHUB_TOKEN (provided automatically in Actions) OR ORG_GRAPHQL_TOKEN (if configured manually)
 *   - GITHUB_REPOSITORY = "owner/repo" (provided automatically in Actions)
 *
 * Optional env:
 *   - CONTRIB_SINCE_DAYS (default 365)
 *   - CONTRIB_AVATAR_SIZE (default 64)
 */

const fs = require("fs");
const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");

const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

// 🔑 Support multiple env var names
const TOKEN =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  process.env.ORG_GRAPHQL_TOKEN;

if (!TOKEN) {
  console.error("❌ Missing token (expected GITHUB_TOKEN, GH_TOKEN, or ORG_GRAPHQL_TOKEN).");
  process.exit(1);
}

const REPO_FULL = process.env.GITHUB_REPOSITORY; // e.g. "owner/repo"
if (!REPO_FULL || !REPO_FULL.includes("/")) {
  console.error("❌ Missing or invalid GITHUB_REPOSITORY env.");
  process.exit(1);
}

const [owner, repo] = REPO_FULL.split("/");
const sinceDays = parseInt(process.env.CONTRIB_SINCE_DAYS || "365", 10);
const AVATAR_SIZE = parseInt(process.env.CONTRIB_AVATAR_SIZE || "64", 10);

const octokit = new MyOctokit({ auth: TOKEN });

// ----- Helpers -----
async function paginate(method, params) {
  const out = [];
  for await (const res of octokit.paginate.iterator(method, params)) {
    out.push(...res.data);
  }
  return out;
}

function buildAvatarGrid(list, size) {
  if (!list.length) return "<!-- none -->";
  const items = list
    .map((p) => {
      const title = `${p.login} • ${p.totals.all} contributions (12 mo)`;
      const avatar = `${p.avatar_url}${p.avatar_url.includes("?") ? "&" : "?"}s=${size}`;
      return `  <a href="${p.html_url}" title="${title}"><img src="${avatar}" width="${size}px" alt="${p.login}" /></a>`;
    })
    .join("\n");
  return `<p align="center">\n${items}\n</p>`;
}

function replaceSection(filePath, startTag, endTag, replacement) {
  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️ Skipping missing file: ${filePath}`);
    return false;
  }
  const src = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`<!--\\s*${startTag}\\s*-->[\\s\\S]*?<!--\\s*${endTag}\\s*-->`, 'm');
  if (!re.test(src)) {
    console.warn(`⚠️ Markers not found in ${filePath}: ${startTag} / ${endTag}`);
    return false;
  }
  const block = `<!-- ${startTag} -->\n${(replacement || '').trim()}\n<!-- ${endTag} -->`;
  const out = src.replace(re, block);
  if (out === src) {
    console.log(`ℹ️ ${filePath} section ${startTag} unchanged (content identical)`);
    return false;
  }
  fs.writeFileSync(filePath, out, 'utf8');
  console.log(`✅ Updated ${filePath} section ${startTag}..${endTag}`);
  return true;
}

// Replace or remove an entire wrapper block (e.g., PREV-BLOCK)
function replaceWholeBlock(filePath, wrapperStart, wrapperEnd, newContentOrEmpty) {
  if (!fs.existsSync(filePath)) {
    console.log(`ℹ️ Skipping missing file: ${filePath}`);
    return false;
  }
  const src = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(
    `<!--\\s*${wrapperStart}\\s*-->[\\s\\S]*?<!--\\s*${wrapperEnd}\\s*-->`,
    "m"
  );
  if (!re.test(src)) {
    // Wrapper missing: nothing to do (stay graceful).
    console.warn(`⚠️ Wrapper not found in ${filePath}: ${wrapperStart} / ${wrapperEnd}`);
    return false;
  }
  const out =
    newContentOrEmpty.trim().length > 0
      ? src.replace(
          re,
          `<!-- ${wrapperStart} -->\n${newContentOrEmpty}\n<!-- ${wrapperEnd} -->`
        )
      : src.replace(re, ""); // remove the whole block if empty
  fs.writeFileSync(filePath, out, "utf8");
  console.log(
    `✅ ${newContentOrEmpty.trim().length ? "Updated" : "Removed"} wrapper ${wrapperStart}..${wrapperEnd} in ${filePath}`
  );
  return true;
}

// ----- Data fetch -----
async function listContributors() {
  // Primary: repo contributors
  const contributors = await paginate(octokit.rest.repos.listContributors, {
    owner,
    repo,
    per_page: 100,
  });

  const users = contributors
    .filter((c) => c.type === "User" && !/bot/i.test(c.login))
    .map((c) => ({
      login: c.login,
      html_url: c.html_url || `https://github.com/${c.login}`,
      avatar_url: c.avatar_url,
      totals: { commits: 0, issuesPRs: 0, all: 0 },
      recent: false,
    }));

  // Fallback for very new repos with no contributors yet
  if (users.length === 0) {
    try {
      const events = await paginate(octokit.rest.repos.listPublicEvents, {
        owner,
        repo,
        per_page: 100,
      });
      const seen = new Set();
      for (const e of events) {
        const u = e.actor && e.actor.login;
        if (u && !/bot/i.test(u) && !seen.has(u)) {
          seen.add(u);
          users.push({
            login: u,
            html_url: `https://github.com/${u}`,
            avatar_url: e.actor.avatar_url,
            totals: { commits: 0, issuesPRs: 0, all: 0 },
            recent: false,
          });
        }
      }
    } catch (err) {
      console.warn("⚠️ Events fetch failed (non-critical):", err.message);
    }
  }
  return users;
}

async function countCommits(login, sinceISO) {
  try {
    const commits = await paginate(octokit.rest.repos.listCommits, {
      owner,
      repo,
      author: login,
      since: sinceISO,
      per_page: 100,
    });
    return commits.length;
  } catch (e) {
    console.warn(`⚠️ Commit count failed for ${login}: ${e.message}`);
    return 0;
  }
}

async function countIssuesPRs(login, sinceISO) {
  try {
    const q = `repo:${owner}/${repo} author:${login} created:>=${sinceISO}`;
    const res = await octokit.rest.search.issuesAndPullRequests({
      q,
      per_page: 1,
    });
    return res.data.total_count || 0;
  } catch (e) {
    console.warn(`⚠️ Issues/PRs search failed for ${login}: ${e.message}`);
    return 0;
  }
}

// ----- Main -----
(async function main() {
  try {
    const sinceISO = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

    const people = await listContributors();
    if (people.length === 0) {
      console.log("ℹ️ No contributors found yet. Exiting without changes.");
      process.exit(0);
    }

    for (const p of people) {
      const [commits, issuesPRs] = await Promise.all([
        countCommits(p.login, sinceISO),
        countIssuesPRs(p.login, sinceISO),
      ]);
      p.totals.commits = commits;
      p.totals.issuesPRs = issuesPRs;
      p.totals.all = commits + issuesPRs;
      p.recent = p.totals.all > 0;
    }

    const active = people
      .filter((p) => p.recent)
      .sort((a, b) => b.totals.all - a.totals.all || a.login.localeCompare(b.login));

    const previous = people
      .filter((p) => !p.recent)
      .sort((a, b) => a.login.localeCompare(b.login));

    const activeHTML = buildAvatarGrid(active, AVATAR_SIZE);
    const previousHTML = buildAvatarGrid(previous, AVATAR_SIZE);

    // Build a full "Previous Contributors" block (header + inner markers) if non-empty
    const prevBlock = previous.length
      ? [
          "## Previous Contributors",
          "<!-- PREVIOUS-CONTRIBUTORS:START -->",
          previousHTML,
          "<!-- PREVIOUS-CONTRIBUTORS:END -->",
        ].join("\n")
      : ""; // empty => wrapper will be removed entirely

    const changed = [];

    // README
    if (replaceSection("README.md", "CONTRIBUTORS:START", "CONTRIBUTORS:END", activeHTML))
      changed.push("README.md active");

    // Update or remove entire previous block via wrapper
    replaceWholeBlock("README.md", "PREV-BLOCK:START", "PREV-BLOCK:END", prevBlock);

    // CONTRIBUTING
    if (replaceSection("CONTRIBUTING.md", "CONTRIBUTORS:START", "CONTRIBUTORS:END", activeHTML))
      changed.push("CONTRIBUTING.md active");

    replaceWholeBlock(
      "CONTRIBUTING.md",
      "PREV-BLOCK:START",
      "PREV-BLOCK:END",
      prevBlock
    );

    if (changed.length === 0) {
      console.log("ℹ️ Sections updated (or removed) as needed. Ensure markers exist in both files.");
    } else {
      console.log("✅ Updated:", changed.join(", "));
    }
  } catch (err) {
    console.error("❌ updateContributors.js failed:", err);
    console.error(err.stack || err);
    process.exit(1);
  }
})();