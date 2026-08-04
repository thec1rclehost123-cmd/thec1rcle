import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const email = process.env.QA_GUEST_EMAIL ?? 'qa_guest_2026@test.c1rcle.com';
const password = process.env.QA_GUEST_PASSWORD ?? 'TestPass123!';
const baseUrl = process.env.QA_GUEST_BASE_URL ?? 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.QA_NAVIGATION_TIMEOUT_MS ?? 10_000);
const runLabel = process.env.QA_RUN_LABEL?.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || '';
const outputDir = new URL(
  `./guest-login-session${runLabel ? `-${runLabel}` : ''}/`,
  import.meta.url,
);
await mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
const page = await browser.newPage();
page.setDefaultTimeout(timeoutMs);
await page.setViewport({ width: 1440, height: 1100 });

const responses = [];
const requestStartedAt = new Map();
const resourceFailures = [];
const consoleErrors = [];
const pageErrors = [];
page.on('request', (request) => {
  if (request.url().includes('/api/')) requestStartedAt.set(request, Date.now());
});
page.on('response', (response) => {
  if (response.status() >= 400) {
    resourceFailures.push({
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      url: response.url().replace(/[?].*$/, ''),
      status: response.status(),
    });
  }
  if (!response.url().includes('/api/')) return;
  responses.push({
    method: response.request().method(),
    url: response.url().replace(/[?].*$/, ''),
    status: response.status(),
    elapsedMs: requestStartedAt.has(response.request())
      ? Date.now() - requestStartedAt.get(response.request())
      : null,
  });
});
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

async function screenshot(name) {
  await page.screenshot({
    path: new URL(`${name}.png`, outputDir).pathname,
    fullPage: true,
  });
}

async function fill(selector, value) {
  const input = await page.waitForSelector(selector, { visible: true });
  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value, { delay: 10 });
}

async function clickExactButton(label) {
  await page.waitForFunction(
    (expected) =>
      [...document.querySelectorAll('button')].some(
        (button) =>
          (button.innerText || button.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase() === expected.toLowerCase(),
      ),
    {},
    label,
  );
  await page.evaluate((expected) => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) =>
        (candidate.innerText || candidate.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase() === expected.toLowerCase(),
    );
    button?.click();
  }, label);
}

let stage = 'initialize';
try {
  stage = 'open_login';
  const startedAt = Date.now();
  const loginResponse = await page.goto(`${baseUrl}/login?next=/profile`, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await page.waitForFunction(() => document.body.innerText.includes('WELCOME'));
  await fill('input[type="email"]', email);
  await fill('input[type="password"]', password);
  await screenshot('01-credentials');
  stage = 'submit_login';
  await clickExactButton('Continue');

  stage = 'wait_profile_redirect';
  await page.waitForFunction(
    () =>
      window.location.pathname === '/profile' || window.location.pathname.startsWith('/profile/'),
    { timeout: timeoutMs },
  );
  stage = 'wait_profile_content';
  await page.waitForFunction(() => !document.body.innerText.includes('Loading'));
  await screenshot('02-authenticated-profile');
  const authenticatedPath = new URL(page.url()).pathname;
  const cookiesAfterLogin = (await page.cookies()).map((cookie) => cookie.name);

  stage = 'reload_profile';
  const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded' });
  stage = 'wait_reloaded_profile';
  await page.waitForFunction(
    () =>
      window.location.pathname === '/profile' || window.location.pathname.startsWith('/profile/'),
  );
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const reloadPath = new URL(page.url()).pathname;
  await screenshot('03-reload-persisted');

  stage = 'open_tickets';
  const ticketsResponse = await page.goto(`${baseUrl}/tickets`, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  stage = 'wait_tickets_content';
  await page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes('loading your tickets'),
    { timeout: timeoutMs },
  );
  const ticketsPath = new URL(page.url()).pathname;
  await screenshot('04-authenticated-tickets');

  stage = 'open_mobile_menu';
  await page.setViewport({ width: 390, height: 844 });
  await page.click('button[aria-label="Toggle menu"]');
  stage = 'submit_logout';
  await clickExactButton('Sign Out');
  stage = 'wait_logout_redirect';
  await page.waitForFunction(() => window.location.pathname === '/login', {
    timeout: timeoutMs,
  });
  const logoutPath = new URL(page.url()).pathname;
  const cookiesAfterLogout = (await page.cookies()).map((cookie) => cookie.name);
  const authMeAfterLogout = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  });
  await screenshot('05-logged-out');

  stage = 'verify_logged_out_profile_redirect';
  await page.goto(`${baseUrl}/profile`, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await page.waitForFunction(() => window.location.pathname === '/login', {
    timeout: timeoutMs,
  });
  const protectedPathAfterLogout = new URL(page.url()).pathname;

  const result = {
    passed:
      loginResponse?.status() === 200 &&
      authenticatedPath.startsWith('/profile') &&
      reloadResponse?.status() === 200 &&
      reloadPath.startsWith('/profile') &&
      ticketsResponse?.status() === 200 &&
      ticketsPath === '/tickets' &&
      logoutPath === '/login' &&
      authMeAfterLogout.status === 200 &&
      authMeAfterLogout.body?.authenticated === false &&
      protectedPathAfterLogout === '/login' &&
      resourceFailures.length === 0 &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0,
    email,
    stage: 'complete',
    elapsedMs: Date.now() - startedAt,
    authenticatedPath,
    reloadPath,
    ticketsPath,
    logoutPath,
    protectedPathAfterLogout,
    authMeAfterLogout,
    cookiesAfterLogin,
    cookiesAfterLogout,
    responses,
    resourceFailures,
    consoleErrors,
    pageErrors,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  await screenshot('failure').catch(() => {});
  const result = {
    passed: false,
    email,
    stage: typeof stage === 'string' ? stage : 'unknown',
    finalUrl: page.url(),
    error: error instanceof Error ? error.message : String(error),
    body: await page
      .$eval('body', (body) => body.innerText.replace(/\s+/g, ' ').slice(0, 2_000))
      .catch(() => ''),
    responses,
    resourceFailures,
    consoleErrors,
    pageErrors,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(result, null, 2)}\n`);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  process.exit(process.exitCode ?? 0);
}
