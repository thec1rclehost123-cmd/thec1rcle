import test from "node:test";
import assert from "node:assert/strict";

import { validateConfig } from "../../../lib/server/security.js";

const REQUIRED_ENVS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "RESEND_API_KEY",
  "TICKET_SECRET",
];

const withEnv = (values, fn) => {
  const snapshot = {};

  for (const key of REQUIRED_ENVS.concat(["NODE_ENV", "CI", "VERCEL", "NEXT_PHASE"])) {
    snapshot[key] = process.env[key];
    if (key in values) {
      process.env[key] = values[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("validateConfig allows missing secrets outside production", () => {
  assert.doesNotThrow(() => {
    withEnv({ NODE_ENV: "development" }, () => validateConfig());
  });
});

test("validateConfig throws in production when critical secrets are missing", () => {
  assert.throws(
    () => withEnv({ NODE_ENV: "production" }, () => validateConfig()),
    /Missing critical environment variables:/,
  );
});

test("validateConfig warns instead of throwing during production builds", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);

  try {
    assert.doesNotThrow(() => {
      withEnv(
        {
          NODE_ENV: "production",
          NEXT_PHASE: "phase-production-build",
        },
        () => validateConfig(),
      );
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /BUILD WARNING/);
});
