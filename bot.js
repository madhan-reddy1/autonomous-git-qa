const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runTestBot() {
  const targetUrl = process.env.TARGET_URL || 'https://example.com';
  console.log(`?? Autonomous Bot running checks against: ${targetUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const failedRequests = [];
  page.on('requestfailed', request => {
    failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
  });

  let testStatus = 'PASS';
  let failureDetails = '';
  let screenshotPath = '';

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    const title = await page.title();
    if (!title) {
      throw new Error('Page title is missing or empty.');
    }

    if (consoleErrors.length > 0 || failedRequests.length > 0) {
      testStatus = 'FAIL';
      screenshotPath = path.join(__dirname, 'failure-snapshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      failureDetails = `Detected ${consoleErrors.length} console errors and ${failedRequests.length} failed network requests.`;
    }
  } catch (error) {
    testStatus = 'FAIL';
    screenshotPath = path.join(__dirname, 'crash-snapshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    failureDetails = error.message;
  } finally {
    await browser.close();
  }

  generatePRComment(testStatus, targetUrl, consoleErrors, failedRequests, failureDetails);
}

function generatePRComment(status, url, errors, requests, details) {
  let markdown = '';

  if (status === 'PASS') {
    markdown = `### ?? Autonomous QA Bot: PASSED\n- **Target URL:** ${url}\n- **Result:** All checks completed successfully with zero console errors or failed API requests. Ready for merge!`;
  } else {
    markdown = `### ?? Autonomous QA Bot: FAILED (Launch Blockers Found)\n- **Target URL:** ${url}\n- **Reason:** ${details}\n\n**Console Errors:**\n\`\`\`text\n${JSON.stringify(errors, null, 2)}\n\`\`\`\n\n**Failed Network Requests:**\n\`\`\`text\n${JSON.stringify(requests, null, 2)}\n\`\`\``;
  }

  const outputPath = path.join(__dirname, 'pr-comment.md');
  fs.writeFileSync(outputPath, markdown);
  console.log(`\n?? PR Comment Markdown generated successfully at: ${outputPath}`);
  
  if (status === 'FAIL') {
    process.exit(1);
  }
}

runTestBot();
