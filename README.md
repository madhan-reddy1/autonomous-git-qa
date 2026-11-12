# 🤖 Git-Native Autonomous QA Bot

A lightweight, **Zero-Dashboard** continuous quality assurance engine that automates UI validation, console error trapping, and API failure detection directly inside GitHub Pull Requests.

No dashboards. No extra services. The bot runs in CI, checks your deployed preview (or any URL), and posts a **PASS / FAIL** verdict as a PR comment — failing the check when it finds launch blockers.

## What it checks

- **Console errors** — captures every `console.error` thrown while the page loads.
- **Failed network requests** — catches requests that never complete (DNS, timeout, aborted).
- **Broken API responses** — flags any HTTP response with status **400+** (404s, 500s, etc.).
- **Missing page title** — fails if the page loads with an empty or missing `<title>`.

On failure it captures a **full-page screenshot** (`failure-snapshot.png`) so you can see exactly what broke.

## How it works

1. GitHub Actions triggers the bot on every Pull Request.
2. Playwright launches headless Chromium and loads the target URL (`TARGET_URL`).
3. The bot listens for console errors, failed requests, and bad HTTP responses while the page reaches `networkidle`.
4. It writes the verdict to `pr-comment.md` as Markdown and exits with code `1` on failure — so the PR check goes red and the merge is blocked until the issues are fixed.

## Tech stack

- **Node.js** — runtime
- **Playwright** — headless Chromium browser automation
- **GitHub Actions** — CI trigger on Pull Requests

## Prerequisites

- Node.js 18+ and npm

## Setup

```bash
git clone https://github.com/madhan-reddy1/autonomous-git-qa.git
cd autonomous-git-qa
npm install
```

## Usage

```bash
# Check a single URL (defaults to https://example.com)
TARGET_URL=https://your-site.com npm start

# Check multiple URLs (comma-separated)
TARGET_URLS=https://your-site.com,https://your-site.com/pricing npm start
```

The run writes `pr-comment.md` in the project root. On failure it also saves `failure-snapshot.png` and exits with code `1`.

### Example — PASS

```markdown
### 🤖 Autonomous QA Bot: PASSED
**Target URL:** https://your-site.com
**Result:** All checks completed successfully with zero console errors or failed API requests. Ready for merge!
```

### Example — FAIL

```markdown
### ❌ Autonomous QA Bot: FAILED (Launch Blockers Found)
**Target URL:** https://your-site.com
**Reason:** Detected 2 console errors and 1 failed network requests.

**Console Errors:**
```text
["Failed to load resource: the server responded with a status of 404"]
```

**Failed Network Requests:**
```text
["GET https://your-site.com/api/data - net::ERR_FAILED"]
```
```

## GitHub Actions

The workflow in `.github/workflows/` runs the bot automatically on every Pull Request and posts the verdict as a comment on the PR. Set the `TARGET_URL` secret/variable in your repo settings to point the bot at your preview deployment.

## Project structure

```text
.
├── .github/workflows/   # CI workflow that runs the bot on PRs
├── bot.js               # The QA bot (Playwright checks + PR comment generator)
├── package.json
├── pr-comment.md        # Generated verdict (created on each run)
└── failure-snapshot.png # Full-page screenshot, created only on failure
```

## Why this exists

Manual QA on every PR is slow and error-prone. This bot gives every pull request an automated smoke test — console errors, broken APIs, and failed requests are caught before merge, with the evidence attached, and no dashboard to babysit.
