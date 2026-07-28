import puppeteer from 'puppeteer-core';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const role = process.env.QA_PARTNER_ROLE ?? 'venue';
const email = process.env.QA_PARTNER_EMAIL ?? 'qa_venue_2026@test.c1rcle.com';
const password = process.env.QA_PARTNER_PASSWORD ?? 'TestPass123!';
const baseUrl = process.env.QA_PARTNER_BASE_URL ?? 'http://127.0.0.1:3001';
const routeTimeoutMs = Number(process.env.QA_ROUTE_TIMEOUT_MS ?? 12_000);
const routeSettleMs = Number(process.env.QA_ROUTE_SETTLE_MS ?? 800);
const failFast = process.env.QA_FAIL_FAST === '1';
const runLabel = String(process.env.QA_RUN_LABEL || '')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '-')
  .slice(0, 60);
const outputDir = new URL(
  `./partner-login-${role}${runLabel ? `-${runLabel}` : ''}/`,
  import.meta.url,
);

const routeMap = {
  venue: [
    '/venue',
    '/venue/events',
    '/venue/analytics',
    '/venue/finance',
    '/venue/finance/payouts',
    '/venue/orders',
    '/venue/guest-ops',
    '/venue/tables',
    '/venue/staff',
    '/venue/settings',
  ],
  host: [
    '/host',
    '/host/events',
    '/host/analytics',
    '/host/finance',
    '/host/finance/payouts',
    '/host/promoters',
    '/host/team',
    '/host/settings',
  ],
  promoter: [
    '/promoter',
    '/promoter/events',
    '/promoter/links',
    '/promoter/analytics',
    '/promoter/finance',
    '/promoter/finance/payouts',
    '/promoter/guests',
    '/promoter/settings',
  ],
};

if (!routeMap[role]) throw new Error(`Unsupported partner role: ${role}`);
await mkdir(outputDir, { recursive: true });

const dynamicFixtures = {
  eventId: process.env.QA_EVENT_ID ?? 'd6b896a2-9f8c-4c27-89f1-33930aab64bd',
  hostId: process.env.QA_HOST_ID ?? 'host_89zVPTET',
  venueId: process.env.QA_VENUE_ID ?? 'venue_tEnPagMv',
};

async function discoverRoleRoutes(selectedRole) {
  const root = resolve(process.cwd(), 'apps', 'partner-dashboard', 'app', selectedRole);
  const files = await readdir(root, { recursive: true });
  const routes = [];
  const skipped = [];
  for (const file of files) {
    if (!/(^|[/\\])page[.](js|jsx|ts|tsx)$/.test(file)) continue;
    const relativeDir = dirname(file).split(sep).join('/');
    let route = `/${selectedRole}${relativeDir === '.' ? '' : `/${relativeDir}`}`;

    if (route.includes('[category]')) route = route.replace('[category]', 'overview');
    if (route.includes('/venue/events/[id]')) {
      route = route.replace('[id]', dynamicFixtures.eventId);
    } else if (route.includes('/venue/partners/[id]')) {
      route = route.replace('[id]', dynamicFixtures.hostId);
    } else if (route.includes('/host/partners/[id]')) {
      route = route.replace('[id]', dynamicFixtures.venueId);
    } else if (route.includes('/promoter/partners/[id]')) {
      route = route.replace('[id]', dynamicFixtures.venueId);
    }

    if (route.includes('[')) {
      skipped.push({
        route,
        reason: 'No authoritative QA fixture exists for this dynamic segment',
      });
      continue;
    }
    routes.push(route);
  }
  return {
    routes: [...new Set(routes)].sort((left, right) => left.localeCompare(right)),
    skipped,
  };
}

const discovered = await discoverRoleRoutes(role);
const requestedRoutes = String(process.env.QA_ROUTES || '')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean);
const routesToTest = requestedRoutes.length > 0 ? requestedRoutes : discovered.routes;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = await browser.newPage();
page.setDefaultTimeout(routeTimeoutMs);
await page.setViewport({ width: 1440, height: 1100 });

const consoleEvents = [];
const pageErrors = [];
const networkResponses = [];

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    consoleEvents.push({
      type: message.type(),
      text: message.text(),
      pageUrl: page.url(),
    });
  }
});
page.on('pageerror', (error) => pageErrors.push({ message: error.message, pageUrl: page.url() }));
page.on('response', (response) => {
  if (!response.url().includes('/api/')) return;
  networkResponses.push({
    method: response.request().method(),
    url: response.url().replace(/[?].*$/, ''),
    status: response.status(),
  });
});

async function clickContaining(text) {
  await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('button')].some((button) =>
        (button.innerText || button.textContent || '')
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .includes(expected.toLowerCase()),
      ),
    {},
    text,
  );
  await page.evaluate((expected) => {
    const button = [...document.querySelectorAll('button')].find((candidate) =>
      (candidate.innerText || candidate.textContent || '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .includes(expected.toLowerCase()),
    );
    button?.click();
  }, text);
}

async function fill(selector, value) {
  const input = await page.waitForSelector(selector, { visible: true });
  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value, { delay: 70 });
}

async function screenshot(name) {
  await page.screenshot({
    path: new URL(`${name}.png`, outputDir).pathname,
    fullPage: true,
  });
}

async function closeBrowser() {
  const closePromise = browser.close().catch(() => {});
  await Promise.race([closePromise, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  if (browser.process()?.exitCode == null) browser.process()?.kill('SIGKILL');
}

try {
  const startedAt = Date.now();
  const loginResponse = await page.goto(`${baseUrl}/login?type=${role}`, {
    waitUntil: 'domcontentloaded',
    timeout: routeTimeoutMs,
  });
  await fill('input[type="email"]', email);
  await fill('input[type="password"]', password);
  await screenshot('01-credentials');
  await clickContaining('Continue to Dashboard');

  await page.waitForFunction(
    (expectedRole) =>
      window.location.pathname === `/${expectedRole}` ||
      window.location.pathname.startsWith(`/${expectedRole}/`),
    { timeout: 40_000 },
    role,
  );
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  await screenshot('02-dashboard');

  const routeResults = [];
  let routeIndex = 0;
  for (const route of routesToTest) {
    const routePage = await browser.newPage();
    routePage.setDefaultTimeout(routeTimeoutMs);
    await routePage.setViewport({ width: 1440, height: 1100 });
    const routeConsoleEvents = [];
    const routePageErrors = [];
    const routeNetworkResponses = [];
    const routeRequestStartedAt = new WeakMap();
    routePage.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        routeConsoleEvents.push({
          type: message.type(),
          text: message.text(),
          pageUrl: routePage.url(),
        });
      }
    });
    routePage.on('pageerror', (error) =>
      routePageErrors.push({ message: error.message, pageUrl: routePage.url() }),
    );
    routePage.on('request', (request) => {
      if (request.url().includes('/api/')) {
        routeRequestStartedAt.set(request, Date.now());
      }
    });
    routePage.on('response', (response) => {
      if (!response.url().includes('/api/')) return;
      const request = response.request();
      routeNetworkResponses.push({
        method: request.method(),
        url: response.url().replace(/[?].*$/, ''),
        requestUrl: response.url(),
        status: response.status(),
        elapsedMs: Math.max(0, Date.now() - (routeRequestStartedAt.get(request) ?? Date.now())),
      });
    });
    const routeStartedAt = Date.now();
    let response;
    let navigationError = null;

    try {
      response = await routePage.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: routeTimeoutMs,
      });
      await routePage
        .waitForFunction(
          () => !document.body.innerText.replace(/\s+/g, ' ').includes('AUTHORIZING ACCESS'),
          { timeout: Math.min(routeTimeoutMs, 8_000) },
        )
        .catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, routeSettleMs));
    } catch (error) {
      navigationError = error instanceof Error ? error.message : String(error);
    }

    const bodyText = await routePage
      .$eval('body', (body) => body.innerText.replace(/\s+/g, ' ').slice(0, 2_000))
      .catch(() => '');
    const slug = route === `/${role}` ? 'overview' : route.split('/').slice(2).join('-');
    routeIndex += 1;
    const brokenImages = await routePage
      .$$eval('img', (images) =>
        images
          .filter(
            (image) =>
              image.getBoundingClientRect().width > 0 &&
              image.getBoundingClientRect().height > 0 &&
              image.complete &&
              image.naturalWidth === 0,
          )
          .map((image) => image.currentSrc || image.src),
      )
      .catch(() => []);
    const routeResult = {
      route,
      status: response?.status() ?? null,
      finalUrl: routePage.url(),
      elapsedMs: Date.now() - routeStartedAt,
      navigationError,
      bodyText,
      contentReady: !bodyText.includes('AUTHORIZING ACCESS'),
      consoleEvents: routeConsoleEvents,
      pageErrors: routePageErrors,
      networkResponses: routeNetworkResponses,
      duplicateApiCalls: Object.entries(
        routeNetworkResponses.reduce((counts, apiResponse) => {
          const key = `${apiResponse.method} ${apiResponse.requestUrl}`;
          counts[key] = (counts[key] || 0) + 1;
          return counts;
        }, {}),
      )
        .filter(([, count]) => count >= 3)
        .map(([request, count]) => ({ request, count })),
      brokenImages,
    };
    const hasFailure =
      routeResult.status !== 200 ||
      routeResult.navigationError ||
      !routeResult.contentReady ||
      routeResult.pageErrors.length > 0 ||
      routeResult.brokenImages.length > 0 ||
      routeResult.networkResponses.some((apiResponse) => apiResponse.status >= 400) ||
      routeResult.duplicateApiCalls.length > 0 ||
      /This page couldn.t load|Application error|Internal Server Error/i.test(bodyText);
    if (hasFailure || process.env.QA_SCREENSHOT_ALL === '1') {
      await routePage.screenshot({
        path: new URL(
          `${String(routeIndex).padStart(2, '0')}-${slug || 'overview'}${hasFailure ? '-failure' : ''}.png`,
          outputDir,
        ).pathname,
        fullPage: true,
      });
    }
    routeResults.push(routeResult);
    await routePage.close();
    if (hasFailure && failFast) break;
  }

  const result = {
    passed:
      loginResponse?.status() === 200 &&
      routeResults.every(
        (entry) =>
          entry.status === 200 &&
          !entry.navigationError &&
          entry.contentReady &&
          entry.pageErrors.length === 0 &&
          entry.brokenImages.length === 0 &&
          entry.networkResponses.every((response) => response.status < 400) &&
          entry.finalUrl.includes(`/${role}`),
      ),
    role,
    email,
    loginStatus: loginResponse?.status() ?? null,
    elapsedMs: Date.now() - startedAt,
    routeResults,
    skippedDynamicRoutes: discovered.skipped,
    consoleEvents,
    pageErrors,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        passed: result.passed,
        role,
        elapsedMs: result.elapsedMs,
        routeCount: routeResults.length,
        skippedDynamicRoutes: discovered.skipped,
        routes: routeResults.map((entry) => ({
          route: entry.route,
          status: entry.status,
          finalUrl: entry.finalUrl,
          elapsedMs: entry.elapsedMs,
          contentReady: entry.contentReady,
          consoleErrors: entry.consoleEvents.length,
          pageErrors: entry.pageErrors.length,
          brokenImages: entry.brokenImages,
          apiFailures: entry.networkResponses.filter((response) => response.status >= 400),
          duplicateApiCalls: entry.duplicateApiCalls,
          body: entry.bodyText.slice(0, 180),
        })),
      },
      null,
      2,
    ),
  );
} catch (error) {
  await screenshot('failure').catch(() => {});
  const failure = {
    passed: false,
    role,
    email,
    finalUrl: page.url(),
    error: error instanceof Error ? error.message : String(error),
    bodyText: await page
      .$eval('body', (body) => body.innerText.replace(/\s+/g, ' ').slice(0, 2_500))
      .catch(() => ''),
    consoleEvents,
    pageErrors,
    networkResponses,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(failure, null, 2)}\n`);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
} finally {
  await closeBrowser();
  process.exit(process.exitCode ?? 0);
}
