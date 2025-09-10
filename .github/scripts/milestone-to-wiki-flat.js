const fs = require("fs");
const path = require("path");

// Octokit setup (uses your package.json deps)
const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");
const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

async function main() {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY not set");

  const wikiDir = process.env.WIKI_DIR || "wiki";
  const maxLatest = parseInt(process.env.MAX_LATEST || "3", 10);
  const milestoneNumberEnv = (process.env.MILESTONE_NUMBER || "").trim();

  // Optional: derive milestone number from event payload (milestone event)
  let eventMilestoneNumber = "";
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && fs.existsSync(eventPath)) {
      const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      eventMilestoneNumber = payload?.milestone?.number ? String(payload.milestone.number) : "";
    }
  } catch {}

  const milestoneNumberInput = milestoneNumberEnv || eventMilestoneNumber;

  const octokit = new MyOctokit({ auth: token });

  // Helpers
  const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0, 10) : "—");
  const esc = (s) => String(s || "").replace(/\r?\n/g, " ").trim();
  const cleanTitle = (t) => String(t || "").trim();
  const sprintName = (ms) => {
    const m = (ms?.title || "").match(/(Sprint\s+\d+)/i);
    return m ? m[1] : ms?.title || "Sprint";
  };
  const reviewPageTitle = (base) => cleanTitle(`${base} - Review`);
  const retroPageTitle = (base) => cleanTitle(`${base} - Retro`);

  if (!fs.existsSync(wikiDir)) fs.mkdirSync(wikiDir, { recursive: true });

  // Fetch milestones
  const closedMilestones = await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner,
    repo,
    state: "closed",
    sort: "due_on",
    direction: "desc",
    per_page: 100,
  });
  const openMilestones = await octokit.paginate(octokit.rest.issues.listMilestones, {
    owner,
    repo,
    state: "open",
    sort: "due_on",
    direction: "asc",
    per_page: 100,
  });

  async function writeClosedSprint(ms) {
    const msNumber = ms.number;
    const base = sprintName(ms);

    // Issues for milestone (exclude PRs)
    const allItems = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      state: "all",
      milestone: msNumber,
      per_page: 100,
    });
    const onlyIssues = allItems.filter((i) => !i.pull_request);
    const done = onlyIssues.filter((i) => i.state === "closed");
    const todo = onlyIssues.filter((i) => i.state !== "closed");
    const linkIssue = (x) => `- [#${x.number}](${x.html_url}) ${x.title}`;

    // Review page
    const reviewTitle = reviewPageTitle(base);
    const reviewPath = path.join(wikiDir, `${reviewTitle}.md`);
    const reviewMd = [
      `# ${base} Review`,
      "",
      `- **Milestone:** [${esc(ms.title)}](${ms.html_url})`,
      `- **State:** ${ms.state}`,
      `- **Due:** ${fmtDate(ms.due_on)}  |  **Closed:** ${fmtDate(ms.closed_at)}`,
      `- **Issues:** ${onlyIssues.length} total — ${done.length} closed / ${todo.length} open`,
      "",
      "---",
      "## Outcomes",
      `- All issues: [${esc(ms.title)}](${ms.html_url})`,
      "",
      "### Completed",
      done.length ? done.map(linkIssue).join("\n") : "_None_",
      "",
      "### Not Completed",
      todo.length ? todo.map(linkIssue).join("\n") : "_None_",
      "",
      "---",
      "## Review Notes",
      "- Highlights: _fill in_",
      "- Demos: _links/screenshots_",
      "",
      "## Retrospective (optional)",
      `- See [[${retroPageTitle(base)}]].`,
      "",
      "---",
      "## Links",
      `- Milestone: ${ms.html_url}`,
      `- Repository: https://github.com/${owner}/${repo}`,
      "",
    ].join("\n");
    fs.writeFileSync(reviewPath, reviewMd, "utf8");

    // Retro scaffold (keep existing)
    const retroTitle = retroPageTitle(base);
    const retroPath = path.join(wikiDir, `${retroTitle}.md`);
    if (!fs.existsSync(retroPath)) {
      fs.writeFileSync(
        retroPath,
        [
          `# ${base} Retro`,
          "",
          "## What went well",
          "- ",
          "",
          "## What could be improved",
          "- ",
          "",
          "## Action items",
          "- ",
          "",
          "## Review",
          `- See [[${reviewPageTitle(base)}]].`,
          "",
        ].join("\n"),
        "utf8"
      );
    }
  }

  // If specific milestone was provided: export only if CLOSED
  if (milestoneNumberInput) {
    const { data: ms } = await octokit.rest.issues.getMilestone({
      owner,
      repo,
      milestone_number: parseInt(milestoneNumberInput, 10),
    });
    if (ms.state === "closed") {
      await writeClosedSprint(ms);
    } else {
      console.log(`Milestone #${ms.number} is not closed; skipping page generation.`);
    }
  }

  // Ensure these pages exist
  const practicesPath = path.join(wikiDir, "Practices - How we work.md");
  if (!fs.existsSync(practicesPath)) {
    fs.writeFileSync(
      practicesPath,
      "# Practices – How we work\n\n- Definition of Done\n- Branching strategy\n- Estimation scale\n",
      "utf8"
    );
  }
  const templatesPath = path.join(wikiDir, "Templates - README.md");
  if (!fs.existsSync(templatesPath)) {
    fs.writeFileSync(
      templatesPath,
      "# Templates\n\n- Sprint Review template\n- Sprint Retro template\n",
      "utf8"
    );
  }

  // Generate/refresh pages for all CLOSED milestones
  for (const ms of closedMilestones) {
    await writeClosedSprint(ms);
  }

  // All Sprints page
  const closedRows = closedMilestones.map((ms) => {
    const base = sprintName(ms);
    const review = reviewPageTitle(base);
    const retro = retroPageTitle(base);
    return `| ${base} | Closed | ${fmtDate(ms.due_on)} | ${fmtDate(ms.closed_at)} | [[${review}]] · [[${retro}]] |`;
  });
  const openRows = openMilestones.map((ms) => {
    const base = sprintName(ms);
    return `| ${base} | Open | ${fmtDate(ms.due_on)} | [Milestone](${ms.html_url}) |`;
  });

  const allMd = [
    "# All Sprints",
    "",
    "A consolidated index of all sprints. Closed sprints link to Review/Retro. Open sprints show milestone only.",
    "",
    "## Closed",
    "",
    "| Sprint | State | Due | Closed | Links |",
    "|---|---|---|---|---|",
    closedRows.length ? closedRows.join("\n") : "| _None_ |  |  |  |  |",
    "",
    "## Open",
    "",
    "| Sprint | State | Due | Links |",
    "|---|---|---|---|",
    openRows.length ? openRows.join("\n") : "| _None_ |  |  |  |",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(wikiDir, "Sprints - All.md"), allMd, "utf8");

  // Sidebar (latest N closed)
  const latestClosed = closedMilestones.slice(0, maxLatest);
  const sidebarBlocks = latestClosed
    .map((ms) => {
      const base = sprintName(ms);
      const review = reviewPageTitle(base);
      const retro = retroPageTitle(base);
      return [`- ${base}`, `  - [[${review}]]`, `  - [[${retro}]]`].join("\n");
    })
    .join("\n");
  const sidebar = [
    "[[Home]]",
    "",
    "## Sprints",
    sidebarBlocks || "_No closed sprints yet_",
    "",
    "---",
    "- [[All Sprints|Sprints - All]]",
    "- [[Practices - How we work]]",
    "- [[Templates|Templates - README]]",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(wikiDir, "_Sidebar.md"), sidebar, "utf8");

  // Dynamic Home
  const currentOpen = openMilestones[0] || null; // soonest-due open
  const latest = closedMilestones[0] || null; // most recent closed
  const sections = [
    "# Testing Project Wiki",
    "",
    "Welcome! This wiki tracks our Agile cadence: sprint reviews, retrospectives, and ways of working.",
    "",
  ];
  if (currentOpen) {
    const name = sprintName(currentOpen);
    sections.push(
      "## Current Sprint",
      `**${esc(name)}**`,
      `- Due: ${fmtDate(currentOpen.due_on)}`,
      `- Milestone: [${esc(currentOpen.title)}](${currentOpen.html_url})`,
      ""
    );
  }
  if (latest) {
    const base = sprintName(latest);
    sections.push(
      "## Latest Sprint",
      `**${esc(base)}**`,
      `- Closed: ${fmtDate(latest.closed_at)}`,
      `- [[${reviewPageTitle(base)}]]`,
      `- [[${retroPageTitle(base)}]]`,
      ""
    );
  }
  sections.push(
    "---",
    "### Quick Links",
    "- [[All Sprints|Sprints - All]]",
    "- [[Practices - How we work]]",
    "- [[Templates|Templates - README]]",
    "---",
    "## What this is",
    "- Public record of what we planned, shipped, and learned.",
    "- Great for hiring managers: a transparent view of process and outcomes.",
    ""
  );
  fs.writeFileSync(path.join(wikiDir, "Home.md"), sections.join("\n"), "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});