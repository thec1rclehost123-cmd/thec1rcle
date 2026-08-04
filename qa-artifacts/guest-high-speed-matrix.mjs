import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.QA_GUEST_BASE_URL ?? 'http://localhost:3000';
const eventId = process.env.QA_EVENT_ID ?? 'd6b896a2-9f8c-4c27-89f1-33930aab64bd';
const runLabel = process.env.QA_RUN_LABEL?.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || '';
const outputDir = new URL(
  `./guest-high-speed-matrix${runLabel ? `-${runLabel}` : ''}/`,
  import.meta.url,
);
const navigationTimeoutMs = Number(process.env.QA_NAVIGATION_TIMEOUT_MS ?? 8_000);

const routes = [
  { path: '/explore', expected: ['QA-TEST-2026', 'Launch E2E'] },
  { path: `/event/${eventId}`, expected: ['QA-TEST-2026', '₹499', '₹999'] },
  {
    path: `/events/${eventId}`,
    expected: ['QA-TEST-2026', '₹499', '₹999'],
    finalPath: `/event/${eventId}`,
  },
  {
    path: `/e/${eventId}`,
    expected: ['QA-TEST-2026', '₹499', '₹999'],
    finalPath: `/event/${eventId}`,
  },
  { path: '/host/shruti', expected: ['Shruti'] },
  { path: '/venue/qa-venue-2026', expected: ['QA Venue 2026'] },
  { path: '/venue/qa-venue-2026/menu', expected: ['Menu'] },
  { path: '/hosts', expected: ['Host'] },
  { path: '/venues', expected: ['Venue'] },
  { path: '/about', expected: ['Build the impossible'] },
  { path: '/terms', expected: ['Terms'] },
  { path: '/privacy', expected: ['Privacy'] },
  { path: '/app', expected: ['App'] },
  { path: '/_not-found', expected: ['Lost in the Night'], expectedStatus: 404 },
];
const routeFilter = process.env.QA_ROUTE_FILTER?.trim();
const selectedRoutes = routeFilter ? routes.filter((route) => route.path === routeFilter) : routes;

if (selectedRoutes.length === 0) {
  throw new Error(`No Guest Portal route matched QA_ROUTE_FILTER=${routeFilter}`);
}

await mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking'],
});

async function closeBrowser() {
  const closing = browser.close().catch(() => {});
  await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 1_000))]);
  if (browser.process()?.exitCode == null) browser.process()?.kill('SIGKILL');
}

const results = [];
try {
  for (const route of selectedRoutes) {
    const page = await browser.newPage();
    page.setDefaultTimeout(navigationTimeoutMs);
    await page.setViewport({ width: 1440, height: 1000 });

    const consoleErrors = [];
    const pageErrors = [];
    const failures = [];
    const apiResponses = [];
    const startedAt = Date.now();
    let response = null;
    let navigationError = null;

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      failures.push({
        type: request.resourceType(),
        url: request.url().replace(/[?].*$/, ''),
        error: request.failure()?.errorText ?? 'REQUEST_FAILED',
      });
    });
    page.on('response', (networkResponse) => {
      if (!networkResponse.url().includes('/api/')) return;
      apiResponses.push({
        method: networkResponse.request().method(),
        url: networkResponse.url().replace(/[?].*$/, ''),
        status: networkResponse.status(),
      });
    });

    try {
      response = await page.goto(`${baseUrl}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeoutMs,
      });
      if (route.finalPath) {
        await page
          .waitForFunction(
            (expectedPath) => window.location.pathname === expectedPath,
            { timeout: 3_000 },
            route.finalPath,
          )
          .catch(() => {});
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (error) {
      navigationError = error instanceof Error ? error.message : String(error);
    }

    let interaction = null;
    if (route.path === '/explore' && !navigationError) {
      const search = await page.$('input[type="search"]');
      if (!search) {
        interaction = { passed: false, reason: 'SEARCH_CONTROL_MISSING' };
      } else {
        await search.click({ clickCount: 3 });
        await search.type('Launch E2E', { delay: 10 });
        await page
          .waitForFunction(
            () =>
              document.body.innerText.toLowerCase().includes('launch e2e') &&
              document.querySelector('input[type="search"]')?.value === 'Launch E2E',
            { timeout: 2_000 },
          )
          .catch(() => {});
        interaction = await page.evaluate(() => {
          const text = document.body.innerText.replace(/\s+/g, ' ');
          const normalizedButtons = [...document.querySelectorAll('button')].map((button) =>
            (button.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase(),
          );
          const requiredFilters = ['sort', 'date', 'all cities'];
          const filterButtons = requiredFilters.filter((label) =>
            normalizedButtons.includes(label),
          );
          const searchValue = document.querySelector('input[type="search"]')?.value ?? '';
          return {
            passed:
              searchValue === 'Launch E2E' &&
              text.toLowerCase().includes('launch e2e') &&
              filterButtons.length === requiredFilters.length,
            searchValue,
            searchResultVisible: text.toLowerCase().includes('launch e2e'),
            filterButtons,
          };
        });
      }
    }

    const pageState = await page
      .evaluate(() => {
        const text = document.body.innerText.replace(/\s+/g, ' ').slice(0, 8_000);
        const brokenImages = [...document.querySelectorAll('img[src]')]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => ({
            src: image.currentSrc || image.src,
            alt: image.alt || '',
          }));
        return { text, brokenImages };
      })
      .catch(() => ({ text: '', brokenImages: [] }));

    const finalUrl = page.url();
    const finalPath = (() => {
      try {
        return new URL(finalUrl).pathname;
      } catch {
        return '';
      }
    })();
    const missingExpected = route.expected.filter(
      (value) => !pageState.text.toLowerCase().includes(value.toLowerCase()),
    );
    const expectedStatus = route.expectedStatus ?? 200;
    const apiFailures = apiResponses.filter((entry) => entry.status >= 400);
    const requestFailures = failures.filter((failure) => {
      if (failure.error !== 'net::ERR_ABORTED') return true;
      if (failure.type === 'fetch') return false;
      if (failure.type === 'document' && failure.url.includes('google.com/maps')) return false;
      return true;
    });
    const reportableConsoleErrors =
      expectedStatus === 404
        ? consoleErrors.filter(
            (message) =>
              !message.includes('Failed to load resource') || !message.includes('404 (Not Found)'),
          )
        : consoleErrors;
    const passed =
      response?.status() === expectedStatus &&
      !navigationError &&
      (!route.finalPath || finalPath === route.finalPath) &&
      missingExpected.length === 0 &&
      pageState.brokenImages.length === 0 &&
      requestFailures.length === 0 &&
      apiFailures.length === 0 &&
      reportableConsoleErrors.length === 0 &&
      pageErrors.length === 0 &&
      (interaction ? interaction.passed : true);

    if (!passed) {
      const slug = route.path.replace(/^[/]+|[/]+$/g, '').replaceAll('/', '-') || 'root';
      await page
        .screenshot({
          path: new URL(`failure-${slug}.png`, outputDir).pathname,
          fullPage: true,
        })
        .catch(() => {});
    }

    results.push({
      route: route.path,
      status: response?.status() ?? null,
      finalUrl,
      elapsedMs: Date.now() - startedAt,
      navigationError,
      missingExpected,
      interaction,
      brokenImages: pageState.brokenImages,
      requestFailures,
      apiFailures,
      consoleErrors: reportableConsoleErrors,
      pageErrors,
      body: pageState.text.slice(0, 400),
      passed,
    });
    await writeFile(
      new URL('result.partial.json', outputDir),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          complete: false,
          results,
        },
        null,
        2,
      )}\n`,
    );
    await page.close();
  }

  const report = {
    passed: results.every((result) => result.passed),
    generatedAt: new Date().toISOString(),
    baseUrl,
    eventId,
    navigationTimeoutMs,
    routeFilter: routeFilter ?? null,
    results,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        routes: results.map((result) => ({
          route: result.route,
          status: result.status,
          finalUrl: result.finalUrl,
          elapsedMs: result.elapsedMs,
          apiFailures: result.apiFailures,
          consoleErrors: result.consoleErrors.length,
          pageErrors: result.pageErrors.length,
          brokenImages: result.brokenImages.length,
          missingExpected: result.missingExpected,
          interaction: result.interaction,
          navigationError: result.navigationError,
          passed: result.passed,
        })),
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
} finally {
  await closeBrowser();
  process.exit(process.exitCode ?? 0);
}
