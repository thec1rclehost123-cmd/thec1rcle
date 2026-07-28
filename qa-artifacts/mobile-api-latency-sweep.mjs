import dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';

dotenv.config({
  path: [
    'thec1rcle.nosync/apps/api-gateway/.env.development',
    'thec1rcle.nosync/apps/mobile-app/.env.development',
  ],
  quiet: true,
});

const baseUrl = process.env.QA_GATEWAY_BASE_URL ?? 'http://127.0.0.1:4000';
const eventId = process.env.QA_EVENT_ID ?? 'd6b896a2-9f8c-4c27-89f1-33930aab64bd';
const email = process.env.QA_GUEST_EMAIL ?? 'qa_guest_2026@test.c1rcle.com';
const password = process.env.QA_GUEST_PASSWORD ?? 'TestPass123!';
const sampleCount = Number(process.env.QA_LATENCY_SAMPLE_COUNT ?? 10);
const timeoutMs = Number(process.env.QA_LATENCY_TIMEOUT_MS ?? 15_000);
const slaMs = Number(process.env.QA_LATENCY_SLA_MS ?? 3_000);
const runLabel = String(process.env.QA_RUN_LABEL || 'phase1-20260728')
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, '-');
const outputDir = new URL(`./mobile-api-latency-${runLabel}/`, import.meta.url);

const firebaseApiKey =
  process.env.FIREBASE_API_KEY ??
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ??
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

if (!firebaseApiKey) {
  throw new Error('Firebase API key is required for the Mobile latency sweep');
}

await mkdir(outputDir, { recursive: true });

const authResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    signal: AbortSignal.timeout(timeoutMs),
  },
);
const authBody = await authResponse.json().catch(() => ({}));
if (!authResponse.ok || !authBody.idToken) {
  throw new Error(`Mobile latency authentication failed with HTTP ${authResponse.status}`);
}

const allProbes = [
  { name: 'auth-sync', method: 'POST', path: '/api/v1/auth/sync', body: {} },
  { name: 'onboarding', method: 'GET', path: '/api/v1/users/me/onboarding' },
  { name: 'subscription', method: 'GET', path: '/api/v1/users/me/subscription' },
  {
    name: 'recommendations-v2',
    method: 'GET',
    path: '/api/v1/recommendations?limit=10&contract=v2',
  },
  { name: 'follows', method: 'GET', path: '/api/v1/users/me/follows' },
  { name: 'ticket-wallet', method: 'GET', path: '/api/v1/tickets/my-wallet' },
  {
    name: 'event-detail',
    method: 'GET',
    path: `/api/v1/events/${encodeURIComponent(eventId)}`,
  },
  {
    name: 'event-interested',
    method: 'GET',
    path: `/api/v1/events/${encodeURIComponent(eventId)}/interested?limit=24`,
  },
  { name: 'realtime-session', method: 'POST', path: '/api/v1/realtime/session', body: {} },
];
const requestedProbeNames = new Set(
  String(process.env.QA_LATENCY_PROBES || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
);
const probes =
  requestedProbeNames.size > 0
    ? allProbes.filter((probe) => requestedProbeNames.has(probe.name))
    : allProbes;
if (probes.length === 0) {
  throw new Error('QA_LATENCY_PROBES did not match any configured probe');
}

function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)];
}

const results = [];
for (const probe of probes) {
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const startedAt = performance.now();
    let status = null;
    let error = null;
    let responseCode = null;
    try {
      const response = await fetch(`${baseUrl}${probe.path}`, {
        method: probe.method,
        headers: {
          authorization: `Bearer ${authBody.idToken}`,
          'content-type': 'application/json',
          'x-request-id': `mobile-sla-${runLabel}-${probe.name}-${index + 1}`,
        },
        body: probe.body === undefined ? undefined : JSON.stringify(probe.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      const payload = await response.json().catch(() => null);
      responseCode = payload?.error?.code ?? payload?.code ?? null;
    } catch (caughtError) {
      error = caughtError instanceof Error ? caughtError.message : String(caughtError);
    }
    samples.push({
      sample: index + 1,
      status,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      responseCode,
      error,
    });
  }

  const successfulDurations = samples
    .filter((sample) => sample.status !== null && sample.status < 400 && !sample.error)
    .map((sample) => sample.elapsedMs);
  const p95Ms = percentile(successfulDurations, 95);
  results.push({
    name: probe.name,
    method: probe.method,
    path: probe.path,
    sampleCount,
    successfulSamples: successfulDurations.length,
    p50Ms: percentile(successfulDurations, 50),
    p95Ms,
    maxMs: successfulDurations.length > 0 ? Math.max(...successfulDurations) : null,
    slaMs,
    passed: successfulDurations.length === sampleCount && p95Ms !== null && p95Ms < slaMs,
    samples,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  eventId,
  sampleCount,
  timeoutMs,
  slaMs,
  passed: results.every((result) => result.passed),
  results,
};

await writeFile(new URL('results.json', outputDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      passed: report.passed,
      sampleCount,
      slaMs,
      results: results.map((result) => ({
        name: result.name,
        successfulSamples: result.successfulSamples,
        p50Ms: result.p50Ms,
        p95Ms: result.p95Ms,
        maxMs: result.maxMs,
        passed: result.passed,
        statuses: result.samples.map((sample) => sample.status),
        errors: result.samples.filter((sample) => sample.error),
      })),
    },
    null,
    2,
  ),
);

if (!report.passed) process.exitCode = 1;
