import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.QA_GUEST_BASE_URL ?? 'http://127.0.0.1:3000';
const eventId = process.env.QA_EVENT_ID ?? 'd6b896a2-9f8c-4c27-89f1-33930aab64bd';
const email = process.env.QA_GUEST_EMAIL ?? 'qa_guest_2026@test.c1rcle.com';
const password = process.env.QA_GUEST_PASSWORD ?? 'TestPass123!';
const timeoutMs = Number(process.env.QA_NAVIGATION_TIMEOUT_MS ?? 15_000);
const runLabel = process.env.QA_RUN_LABEL?.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || '';
const outputDir = new URL(
  `./guest-commerce-journey${runLabel ? `-${runLabel}` : ''}/`,
  import.meta.url,
);
await mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--no-default-browser-check',
    '--no-first-run',
  ],
});
const page = await browser.newPage();
page.setDefaultTimeout(timeoutMs);
await page.setViewport({ width: 1440, height: 1100 });

const apiResponses = [];
const requestStartedAt = new Map();
const localFailures = [];
const consoleErrors = [];
const pageErrors = [];
const externalFailures = [];

function redactUrl(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) {
    if (/token|secret|signature|key|code/i.test(key)) url.searchParams.set(key, '[redacted]');
  }
  return url.toString();
}

page.on('request', (request) => {
  requestStartedAt.set(request, Date.now());
});
page.on('response', (response) => {
  const request = response.request();
  const elapsedMs = requestStartedAt.has(request)
    ? Date.now() - requestStartedAt.get(request)
    : null;
  const url = redactUrl(response.url());
  if (url.startsWith(baseUrl) && url.includes('/api/')) {
    apiResponses.push({
      elapsedMs,
      method: request.method(),
      status: response.status(),
      url: url.replace(/[?].*$/, ''),
    });
  }
  if (response.status() >= 400) {
    const failure = {
      elapsedMs,
      method: request.method(),
      resourceType: request.resourceType(),
      status: response.status(),
      url: url.replace(/[?].*$/, ''),
    };
    if (url.startsWith(baseUrl)) localFailures.push(failure);
    else externalFailures.push(failure);
  }
});
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

async function screenshot(name, target = page) {
  await target.screenshot({
    path: new URL(`${name}.png`, outputDir).pathname,
    fullPage: true,
  });
}

async function fill(selector, value, target = page) {
  const input = await target.waitForSelector(selector, { visible: true });
  await input.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await input.type(value, { delay: 8 });
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function clickButton(label, target = page, exact = true) {
  await target.waitForFunction(
    (expected, requireExact) =>
      [...document.querySelectorAll('button, [role="button"]')].some((element) => {
        const text = (element.innerText || element.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return requireExact
          ? text === expected.toLowerCase()
          : text.includes(expected.toLowerCase());
      }),
    {},
    label,
    exact,
  );
  await target.evaluate(
    (expected, requireExact) => {
      const element = [...document.querySelectorAll('button, [role="button"]')].find(
        (candidate) => {
          const text = (candidate.innerText || candidate.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
          return requireExact
            ? text === expected.toLowerCase()
            : text.includes(expected.toLowerCase());
        },
      );
      element?.click();
    },
    label,
    exact,
  );
}

async function frameDiagnostics() {
  return Promise.all(
    page.frames().map(async (frame) => ({
      inputs: await frame
        .$$eval('input', (inputs) =>
          inputs.map((input) => ({
            autocomplete: input.autocomplete,
            name: input.name,
            placeholder: input.placeholder,
            type: input.type,
          })),
        )
        .catch(() => []),
      text: await frame
        .$eval('body', (body) => body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1_500))
        .catch(() => ''),
      url: redactUrl(frame.url()),
    })),
  );
}

async function findFrameWithSelector(selectors) {
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const element = await frame.$(selector).catch(() => null);
      if (element) return { element, frame, selector };
    }
  }
  return null;
}

async function typeAcrossFrames(selectors, value) {
  const match = await findFrameWithSelector(selectors);
  if (!match) return false;
  await match.element.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await match.element.type(value, { delay: 8 });
  return true;
}

async function clickTextAcrossFrames(pattern) {
  for (const frame of page.frames()) {
    const clicked = await frame
      .evaluate((source) => {
        const regex = new RegExp(source, 'i');
        const candidates = [
          ...document.querySelectorAll(
            'button, [role="button"], label, a, input[type="submit"], input[type="button"]',
          ),
        ];
        const target = candidates.find((element) => {
          const text = `${element.innerText || element.textContent || ''} ${element.value || ''}`
            .replace(/\s+/g, ' ')
            .trim();
          return regex.test(text) && !element.disabled;
        });
        if (!target) return false;
        target.click();
        return true;
      }, pattern.source)
      .catch(() => false);
    if (clicked) return true;
  }
  return false;
}

async function waitForAnyFrameSelector(selectors, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const match = await findFrameWithSelector(selectors);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

async function completeRazorpayPayment() {
  const cardSelectors = [
    'input[name="card[number]"]',
    'input[autocomplete="cc-number"]',
    'input[placeholder*="card number" i]',
    'input[placeholder*="card" i]',
  ];
  let cardInput = await waitForAnyFrameSelector(cardSelectors, 8_000);
  if (!cardInput) {
    await clickTextAcrossFrames(/^card$/i);
    cardInput = await waitForAnyFrameSelector(cardSelectors, 8_000);
  }
  if (!cardInput) {
    throw new Error('Razorpay card form did not become available');
  }

  const cardNumberEntered = await typeAcrossFrames(cardSelectors, '4100280000001007');
  const expiryEntered = await typeAcrossFrames(
    [
      'input[name="card[expiry]"]',
      'input[autocomplete="cc-exp"]',
      'input[placeholder*="expiry" i]',
      'input[placeholder*="MM" i]',
    ],
    '1228',
  );
  const cvvEntered = await typeAcrossFrames(
    [
      'input[name="card[cvv]"]',
      'input[autocomplete="cc-csc"]',
      'input[placeholder*="cvv" i]',
      'input[placeholder*="security" i]',
    ],
    '123',
  );
  if (!cardNumberEntered || !expiryEntered || !cvvEntered) {
    throw new Error(
      `Razorpay card form incomplete: card=${cardNumberEntered} expiry=${expiryEntered} cvv=${cvvEntered}`,
    );
  }

  await screenshot('04-razorpay-card-entered');
  if (!(await clickTextAcrossFrames(/pay|proceed|continue|submit/i))) {
    throw new Error('Razorpay payment submit control was not found');
  }

  const paymentDeadline = Date.now() + 40_000;
  while (Date.now() < paymentDeadline) {
    if (
      new URL(page.url()).pathname.startsWith('/confirmation/') ||
      (await page.$eval('body', (body) => body.innerText.includes("YOU'RE IN")).catch(() => false))
    ) {
      return;
    }

    const otpEntered = await typeAcrossFrames(
      [
        'input[name*="otp" i]',
        'input[autocomplete="one-time-code"]',
        'input[placeholder*="otp" i]',
        'input[type="tel"]',
      ],
      '123456',
    );
    if (otpEntered) {
      await clickTextAcrossFrames(/submit|verify|continue|pay/i);
    } else {
      await clickTextAcrossFrames(/^success$|make payment|complete payment/i);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error('Razorpay payment did not return to the Guest Portal within 40 seconds');
}

let stage = 'initialize';
let orderId = null;
let razorpayOrderId = null;
const startedAt = Date.now();
try {
  stage = 'open_login';
  const loginResponse = await page.goto(
    `${baseUrl}/login?next=${encodeURIComponent(`/checkout/${eventId}`)}`,
    { waitUntil: 'domcontentloaded', timeout: timeoutMs },
  );
  await page.waitForFunction(() => document.body.innerText.includes('WELCOME'));
  await fill('input[type="email"]', email);
  await fill('input[type="password"]', password);

  stage = 'submit_login';
  await clickButton('Continue');
  await page.waitForFunction(
    (expectedEventId) => window.location.pathname === `/checkout/${expectedEventId}`,
    { timeout: timeoutMs },
    eventId,
  );

  stage = 'wait_checkout';
  await page.waitForFunction(
    () => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('select your') && !text.includes('syncing live availability');
    },
    { timeout: timeoutMs },
  );
  const checkoutPath = new URL(page.url()).pathname;
  const checkoutText = await page.$eval('body', (body) => body.innerText);
  if (!checkoutText.includes('EARLY BIRD') || !checkoutText.includes('₹499')) {
    throw new Error('Early Bird ₹499 tier was not rendered');
  }

  stage = 'select_ticket';
  const selected = await page.evaluate(() => {
    const tier = [...document.querySelectorAll('h3')].find((heading) =>
      (heading.textContent || '').toLowerCase().includes('early bird'),
    );
    const card = tier?.closest('div[class*="rounded-"]');
    const plus = [...(card?.querySelectorAll('button') || [])].find(
      (button) => (button.textContent || '').trim() === '+',
    );
    plus?.click();
    return Boolean(plus);
  });
  if (!selected) throw new Error('Early Bird quantity control was not found');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some((button) =>
      String(button.innerText || button.textContent)
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .startsWith('continue • ₹499'),
    ),
  );
  await screenshot('01-ticket-selected');

  stage = 'attendee_details';
  await clickButton('CONTINUE', page, false);
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('enter your'));
  await fill('input[type="text"]', '[QA-TEST-2026] Guest Buyer');
  await fill('input[type="email"]', email);
  await fill('input[type="tel"]', '9000002026');
  await screenshot('02-attendee-details');

  stage = 'review_payment';
  await clickButton('Review & Payment');
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('payment &'));
  await screenshot('03-payment-review');

  stage = 'initiate_payment';
  await clickButton('Confirm Order');
  await waitForAnyFrameSelector(['body'], timeoutMs);
  await page.waitForFunction(
    () => document.querySelector('iframe.razorpay-checkout-frame') !== null,
    { timeout: timeoutMs },
  );
  const diagnosticsBeforePayment = await frameDiagnostics();
  const initiateResponse = [...apiResponses]
    .reverse()
    .find((response) => response.url.endsWith('/api/app/checkout/initiate'));
  razorpayOrderId =
    diagnosticsBeforePayment
      .map((entry) => entry.url)
      .join(' ')
      .match(/order_[A-Za-z0-9]+/)?.[0] || null;

  stage = 'complete_razorpay';
  await completeRazorpayPayment();

  stage = 'wait_confirmation';
  await page.waitForFunction(() => window.location.pathname.startsWith('/confirmation/'), {
    timeout: timeoutMs + 8_000,
  });
  orderId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
  await page.waitForFunction(
    () =>
      !document.body.innerText.toLowerCase().includes('loading') &&
      !document.body.innerText.toLowerCase().includes('verifying'),
    { timeout: timeoutMs },
  );
  const confirmationText = await page.$eval('body', (body) => body.innerText);
  await screenshot('05-confirmation');

  stage = 'open_wallet';
  const ticketsResponse = await page.goto(`${baseUrl}/tickets`, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  await page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes('loading your tickets'),
    { timeout: timeoutMs },
  );
  const walletText = await page.$eval('body', (body) => body.innerText);
  await screenshot('06-wallet');

  const checkoutCalls = apiResponses.filter((entry) =>
    /\/api\/app\/checkout\/(quote|reserve|initiate|verify)$/.test(entry.url),
  );
  const counts = Object.fromEntries(
    ['quote', 'reserve', 'initiate', 'verify'].map((operation) => [
      operation,
      checkoutCalls.filter((entry) => entry.url.endsWith(`/checkout/${operation}`)).length,
    ]),
  );
  const result = {
    apiResponses,
    checkoutCalls,
    checkoutPath,
    confirmationText: confirmationText.replace(/\s+/g, ' ').slice(0, 2_000),
    consoleErrors,
    counts,
    elapsedMs: Date.now() - startedAt,
    email,
    eventId,
    externalFailures,
    localFailures,
    orderId,
    pageErrors,
    passed:
      loginResponse?.status() === 200 &&
      checkoutPath === `/checkout/${eventId}` &&
      counts.reserve === 1 &&
      counts.initiate === 1 &&
      counts.verify === 1 &&
      Boolean(orderId) &&
      /confirmed|you're in|order confirmed/i.test(confirmationText) &&
      walletText.includes('[QA-TEST-2026] Launch E2E') &&
      ticketsResponse?.status() === 200 &&
      localFailures.length === 0 &&
      consoleErrors.length === 0 &&
      pageErrors.length === 0,
    razorpayOrderId,
    stage: 'complete',
    walletText: walletText.replace(/\s+/g, ' ').slice(0, 2_000),
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  const diagnostics = await frameDiagnostics().catch(() => []);
  await screenshot('failure').catch(() => {});
  const result = {
    apiResponses,
    consoleErrors,
    diagnostics,
    elapsedMs: Date.now() - startedAt,
    email,
    error: error instanceof Error ? error.message : String(error),
    eventId,
    externalFailures,
    finalUrl: page.url(),
    localFailures,
    orderId,
    pageErrors,
    razorpayOrderId,
    stage,
  };
  await writeFile(new URL('result.json', outputDir), `${JSON.stringify(result, null, 2)}\n`);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  process.exit(process.exitCode ?? 0);
}
