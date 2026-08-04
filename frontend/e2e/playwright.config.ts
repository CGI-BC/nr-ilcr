import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * E2E — Playwright + BDD config (BC Gov NR stack).
 *
 * Architecture: the `.feature` files under `features/` are the executable spec; `bddgen test`
 * compiles them into native Playwright tests (in the generated `testDir` below) using the step
 * definitions under `steps/`. Everything downstream — reporters, tracing, parallelism, fixtures,
 * page objects — is stock Playwright, unchanged by BDD. Run via `npm test` (the `pretest` hook runs
 * `bddgen test` first) or `npx bddgen test && npx playwright test`.
 *
 * Runs against an ALREADY-RUNNING local system (we do NOT start servers here, because the app is a
 * two-process stack — Vite frontend on :3000 + Spring backend on :8080 — plus a Docker Oracle DB,
 * each with its own env. Bring them up per e2e/README.md, then run the tests).
 *
 * Timeout / artifact standards follow the TEA `playwright-config` guardrails.
 */
// CI (the reusable-tests e2e job) passes the deployed environment URL as E2E_BASE_URL; locally we read
// BASE_URL from .env (defaulting to the Vite dev server).
const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3000';

// Browser channel: locally we pin the machine's installed Google Chrome because the CGI corporate proxy
// blocks Playwright's managed-chromium CDN download. CI has no such proxy and runs
// `npx playwright install chromium`, so there we leave the channel unset to use the managed chromium.
const CHANNEL = process.env.CI ? undefined : 'chrome';

// Compile features/*.feature + steps/*.ts into generated Playwright tests; returns their dir.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      // Runs ONCE before the suite (chromium depends on it): asserts the pinned real-data anchors still
      // resolve, so a stale/re-extracted DB fails fast with one clear "re-ground the fixtures" message
      // rather than dozens of confusing mid-suite failures. See preflight/anchors.setup.ts.
      name: 'setup',
      testDir: './preflight',
      testMatch: /.*\.setup\.ts$/,
    },
    {
      // Data-independent app-shell smoke (@smoke). Deliberately has NO `setup` dependency and the
      // scenarios abort all /api, so this project runs with NO backend / seeded Oracle — the every-PR CI
      // gate that lets this suite stand in for the app repo's frontend/e2e app-shell smoke. Run alone
      // with `npx playwright test --project=smoke` (only the frontend need be served).
      name: 'smoke',
      testDir,
      grep: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        channel: CHANNEL,
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      // The @smoke scenarios run in the dedicated `smoke` project above (no DB); exclude them here so a
      // full local run doesn't execute them twice.
      grepInvert: /@smoke/,
      use: {
        ...devices['Desktop Chrome'],
        // Use the machine's installed Google Chrome instead of Playwright's managed chromium: the
        // CGI corporate proxy intercepts TLS and blocks the chromium CDN download
        // (UNABLE_TO_GET_ISSUER_CERT_LOCALLY), so `npx playwright install chromium` cannot fetch the
        // build 1.62.0 expects. The system Chrome channel needs no download and is the same approach
        // the app's own frontend e2e suite uses.
        channel: CHANNEL,
        // Taller than devices['Desktop Chrome']'s own 1280x720 default (must come AFTER the spread —
        // devices['Desktop Chrome'] sets its own viewport, which would otherwise win the merge): at
        // 720px, a Carbon Modal's footer buttons (e.g. a tall Carbon form's modal footer button) sit close
        // enough to the bottom edge that a coordinate-based click lands on the modal's own outer
        // wrapper instead of the button (confirmed via document.elementFromPoint at the button's
        // center) — not an app bug, just an unrealistically short viewport for an 8+ field form.
        // 900px matches a realistic admin desktop.
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
});
