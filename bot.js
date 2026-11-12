const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// One URL via TARGET_URL, or several comma-separated via TARGET_URLS.
function getTargetUrls() {
  const multi = process.env.TARGET_URLS;
  if (multi) return multi.split(',').map((u) => u.trim()).filter(Boolean);
  return [process.env.TARGET_URL || 'https://example.com'];
}

async function checkUrl(browser, targetUrl) {
  console.log(`🤖 Checking: ${targetUrl}`);

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`
    );
  });

  // A 404/500 that completes is NOT a 'requestfailed' event — catch it here.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.request().method()} ${response.url()} - HTTP ${response.status()}`);
    }
  });

  let status = 'PASS';
  let failureDetails = '';
  let screenshotPath = '';

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const title = await page.title();
    if (!title) {
      throw new Error('Page title is missing or empty.');
    }

    const problems = consoleErrors.length + failedRequests.length + badResponses.length;
    if (problems > 0) {
      status = 'FAIL';
      screenshotPath = path.join(__dirname, 'failure-snapshot.png');
      await page.waitForTimeout(500);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      failureDetails = `Detected ${consoleErrors.length} console errors, ${failedRequests.length} failed network requests, and ${badResponses.length} broken (4xx/5xx) responses.`;
    }
  } catch (error) {
    status = 'FAIL';
    screenshotPath = path.join(__dirname, 'failure-snapshot.png');
    await page.waitForTimeout(500);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    failureDetails = error.message;
    console.error('Test failed, captured failure-snapshot.png:', error.message);
  } finally {
    await context.close();
  }

  return { url: targetUrl, status, consoleErrors, failedRequests, badResponses, failureDetails };
}

function generatePRComment(results) {
  const failed = results.filter((r) => r.status === 'FAIL');
  const overall = failed.length === 0 ? 'PASS' : 'FAIL';

  let markdown = '';
  if (overall === 'PASS') {
    const lines = results
      .map((r) => `- ✅ ${r.url} — no console errors, no failed requests, no broken responses.`)
      .join('\n');
    markdown = `### 🤖 Autonomous QA Bot: PASSED\n${lines}\n**Result:** All checks completed successfully. Ready for merge!`;
  } else {
    const sections = failed
      .map(
        (r) =>
          `**Target URL:** ${r.url}\n**Reason:** ${r.failureDetails}\n\n**Console Errors:**\n\`\`\`text\n${JSON.stringify(r.consoleErrors, null, 2)}\n\`\`\`\n\n**Failed Network Requests:**\n\`\`\`text\n${JSON.stringify(r.failedRequests, null, 2)}\n\`\`\`\n\n**Broken Responses (4xx/5xx):**\n\`\`\`text\n${JSON.stringify(r.badResponses, null, 2)}\n\`\`\``
      )
      .join('\n\n---\n\n');
    markdown = `### ❌ Autonomous QA Bot: FAILED (Launch Blockers Found)\n${sections}`;
  }

  const outputPath = path.join(__dirname, 'pr-comment.md');
  fs.writeFileSync(outputPath, markdown);
  console.log(`\n📄 PR Comment Markdown generated successfully at: ${outputPath}`);
  return overall;
}

async function runTestBot() {
  const urls = getTargetUrls();
  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const url of urls) {
      results.push(await checkUrl(browser, url));
    }
    const overall = generatePRComment(results);
    if (overall === 'FAIL') process.exit(1);
  } finally {
    await browser.close();
  }
}

runTestBot();
