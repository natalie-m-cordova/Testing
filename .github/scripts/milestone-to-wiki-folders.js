const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { restEndpointMethods } = require("@octokit/plugin-rest-endpoint-methods");
const MyOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

(async function main() {
  const token = process.env.GITHUB_TOKEN || "";
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY not set");

  const wikiDir = process.env.WIKI_DIR || "wiki";
  const maxLatest = parseInt(process.env.MAX_LATEST || "3", 10);
  const milestoneNumberEnv = (process.env.MILESTONE_NUMBER || "").trim();

  if (!fs.existsSync(wikiDir)) fs.mkdirSync(wikiDir, { recursive: true });

  const octokit = new MyOctokit({ auth: token });

  const fmtDate = (s) => (s ? new Date(s).toISOString().slice(0, 10) : "—");
  const esc = (s) => String(s || "").replace(/\r?\n/g, " ").trim();
  const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
  const safePath = (title) =>
    String(title || "").replace(/[<>:"|?*]/g, "-").replace(/\s+/g, " ").trim();

  const sprintName = (ms) => {
    const m = (ms?.title || "").match(/(Sprint\s+\d+)/i);
    return m ? m[1] : ms?.title || "Sprint";
  };

  // Pull milestone number from event payload if not provided
  let eventMilestoneNumber = "";
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && fs.existsSync(eventPath)) {
      const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      eventMilestoneNumber = payload?.milestone?.number
        ? String(payload.milestone.number)
        : "";
    }
  } catch {}

  let milestoneNumber = milestoneNumberEnv || eventMilestoneNumber;

  // Fetch milestones
  const closedMilestones = await octokit.paginate(
    octokit.rest.issues.listMilestones,
    { owner, repo, state: "closed", sort: "due_on", direction: "desc", per_page: 100 }
  );
  const openMilestones = await octokit.paginate(
    octokit.rest.issues.listMilestones,
    { owner, repo, state: "open", sort: "due_on", direction: "asc", per_page: 100 }
  );

  // Default sprint to render in full: latest closed, else first open
  if (!milestoneNumber) {
    if (closedMilestones.length > 0) milestoneNumber = String(closedMilestones[0].number);
    else if (openMilestones.length > 0) milestoneNumber = String(openMilestones[0].number);
  }

  async function writeSprintReview(msNumber) {
    const { data: ms } = await octokit.rest.issues.getMilestone({
      owner, repo, milestone_number: msNumber
    });

    // Issues for milestone (exclude PRs)
    const allItems = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner, repo, state: "all", milestone: msNumber, per_page: 100
    });
    const onlyIssues = allItems.filter((i) => !i.pull_request);
    const done = onlyIssues.filter((i) => i.state === "closed");
    const todo = onlyIssues.filter((i) => i.state !== "closed");
    const linkIssue = (x) => `- [#${x.number}](${x.html_url}) ${x.title}`;

    const m = (ms.title || "").match(/(Sprint\s+\d+)/i);
    const sprintBase = m ? m[1] : (ms.title || "Sprint");

    // Folder: wiki/Sprints/<Sprint N>/
    const sprintFolder = path.join(wikiDir, "Sprints", safePath(sprintBase));
    mkdirp(sprintFolder);

    // Review page
    const reviewFile = path.join(sprintFolder, "Review.md");
    const reviewMd = [
      `# ${sprintBase} Review`,
      "",
      `**Milestone:** [${esc(ms.title)}](${ms.html_url})`,
      `**State:** ${ms.state}`,
      `**Due:** ${fmtDate(ms.due_on)}  |  **Closed:** ${fmtDate(ms.closed_at)}`,
      `**Issues:** ${onlyIssues.length} total — ${done.length} closed / ${todo.length} open`,
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
      `- See [[${sprintBase} Retro|Sprints/${safePath(sprintBase)}/Retro]].`,
      "",
      "---",
      "## Links",
      `- Milestone: ${ms.html_url}`,
      `- Repository: https://github.com/${owner}/${repo}`,
      "",
    ].join("\n");
    fs.writeFileSync(reviewFile, reviewMd, "utf8");

    // Retro scaffold (keep existing if present)
    const retroFile = path.join(sprintFolder, "Retro.md");
    if (!fs.existsSync(retroFile)) {
      fs.writeFileSync(
        retroFile,
        [
          `# ${sprintBase} Retro`,
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
        ].join("\n"),
        "utf8"
      );
    }
  }

  // Write selected sprint's Review
  if (milestoneNumber) {
    try { await writeSprintReview(parseInt(milestoneNumber, 10)); }
    catch (e) { console.warn(`Could not write selected milestone #${milestoneNumber}: ${e.message}`); }
  }

  // Ensure Practices & Templates exist
  const practicesFile = path.join(wikiDir, "Practices", "How-we-work.md");
  mkdirp(path.dirname(practicesFile));
  if (!fs.existsSync(practicesFile)) {
    fs.writeFileSync(
      practicesFile,
      "# Practices – How we work\n\n- Definition of Done\n- Branching strategy\n- Estimation scale\n",
      "utf8"
    );
  }
  const templatesFile = path.join(wikiDir, "Templates", "README.md");
  mkdirp(path.dirname(templatesFile));
  if (!fs.existsSync(templatesFile)) {
    fs.writeFileSync(
      templatesFile,
      "# Templates\n\n- Sprint Review template\n- Sprint Retro template\n",
      "utf8"
    );
  }

  // Build/refresh All Sprints table (closed first, then open)
  const allMilestones = [
    ...closedMilestones.map((m) => ({ ...m, _stateOrder: 0 })),
    ...openMilestones.map((m) => ({ ...m, _stateOrder: 1 })),
  ];

  const rows = allMilestones.map((m) => {
    const sm = (m.title || "").match(/(Sprint\s+\d+)/i);
    const base = sm ? sm[1] : (m.title || "Sprint");
    const basePath = `Sprints/${safePath(base)}`;

    const sprintFolder = path.join(wikiDir, basePath);
    mkdirp(sprintFolder);

    // Ensure placeholder pages exist
    const reviewPath = path.join(sprintFolder, "Review.md");
    if (!fs.existsSync(reviewPath)) fs.writeFileSync(reviewPath, `# ${base} Review\n\n_(coming soon)_\n`, "utf8");
    const retroPath = path.join(sprintFolder, "Retro.md");
    if (!fs.existsSync(retroPath)) fs.writeFileSync(retroPath, `# ${base} Retro\n\n_(coming soon)_\n`, "utf8");

    const due = fmtDate(m.due_on);
    const closed = fmtDate(m.closed_at);
    const statePretty = m.state === "closed" ? "Closed" : "Open";
    const reviewLink = `[[Review|${basePath}/Review]]`;
    const retroLink = `[[Retro|${basePath}/Retro]]`;

    return {
      isClosed: m.state === "closed",
      dueOn: m.due_on || "",
      md: `| [[${base}|${basePath}]] | ${statePretty} | ${due} | ${closed} | ${reviewLink} · ${retroLink} |`,
    };
  });

  const closedRows = rows
    .filter((r) => r.isClosed)
    .sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1));
  const openRows = rows
    .filter((r) => !r.isClosed)
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));

  const allMd = [
    "# All Sprints",
    "",
    "A consolidated index of all sprints. Columns show current state, due/closed dates, and quick links.",
    "",
    "## Closed",
    "",
    "| Sprint | State | Due | Closed | Links |",
    "|---|---|---|---|---|",
    closedRows.length ? closedRows.map((r) => r.md).join("\n") : "| _None_ |  |  |  |  |",
    "",
    "## Open",
    "",
    "| Sprint | State | Due | Closed | Links |",
    "|---|---|---|---|---|",
    openRows.length ? openRows.map((r) => r.md).join("\n") : "| _None_ |  |  |  |  |",
    "",
  ].join("\n");

  const allSprintsFile = path.join(wikiDir, "Sprints", "All.md");
  mkdirp(path.dirname(allSprintsFile));
  fs.writeFileSync(allSprintsFile, allMd, "utf8");

  // Sidebar with latest N closed sprints
  const latest = closedMilestones.slice(0, maxLatest);
  const sidebarBlocks = latest
    .map((m) => {
      const sm = (m.title || "").match(/(Sprint\s+\d+)/i);
      const base = sm ? sm[1] : (m.title || "Sprint");
      const basePath = `Sprints/${safePath(base)}`;
      const reviewLink = `[[${base} Review|${basePath}/Review]]`;
      const retroLink = `[[${base} Retro|${basePath}/Retro]]`;
      return [`- ${base}`, `  - ${reviewLink}`, `  - ${retroLink}`].join("\n");
    })
    .join("\n");

  const sidebar = [
    "[[Home]]",
    "",
    "## Sprints",
    sidebarBlocks || "_No closed sprints yet_",
    "",
    "---",
    "[[All Sprints|Sprints/All]]",
    "[[Practices - How we work|Practices/How-we-work]]",
    "[[Templates|Templates/README]]",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(wikiDir, "_Sidebar.md"), sidebar, "utf8");

  // Dynamic Home.md
  const currentOpen = openMilestones[0] || null; // soonest-due open
  const latestClosed = closedMilestones[0] || null; // most recent closed
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
      `Due: ${fmtDate(currentOpen.due_on)}`,
      `Milestone: [${esc(currentOpen.title)}](${currentOpen.html_url})`,
      ""
    );
  }

  if (latestClosed) {
    const name = sprintName(latestClosed);
    const basePath = `Sprints/${safePath(name)}`;
    const links = `[[Review|${basePath}/Review]] · [[Retro|${basePath}/Retro]]`;
    sections.push(
      "## Latest Sprint",
      `**${esc(name)}**`,
      `Closed: ${fmtDate(latestClosed.closed_at)}`,
      links,
      ""
    );
  }

  sections.push(
    "---",
    "### Quick Links",
    "- [[All Sprints|Sprints/All]]",
    "- [[Practices - How we work|Practices/How-we-work]]",
    "- [[Templates|Templates/README]]",
    "---",
    "## What this is",
    "- Public record of what we planned, shipped, and learned.",
    "- Great for hiring managers: a transparent view of process and outcomes.",
    ""
  );
  fs.writeFileSync(path.join(wikiDir, "Home.md"), sections.join("\n"), "utf8");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});