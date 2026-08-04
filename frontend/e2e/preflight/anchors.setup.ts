import { test, expect, type APIRequestContext } from '@playwright/test';
import { MUTABLE_DRAFT, READONLY_ANCHOR, scheduleUrl } from '../fixtures/sch1/schedule1-test-data';

/**
 * Suite PREFLIGHT — runs once (as the `setup` project the `chromium` project depends on) before any
 * scenario. It asserts the pinned real-data anchors still resolve in the loaded DB, so a stale /
 * re-extracted DB (or a backend that booted before its DB) fails HERE with ONE clear message instead of
 * dozens of confusing mid-suite failures. All checks go through the app's own API — no Oracle client at
 * runtime — and are read-only.
 */

const REGROUND =
  'Re-ground: reload the real extract (README step 1), evict the reference-data cache or restart the ' +
  'backend, then re-verify the pinned Schedule 1 anchors in fixtures/sch1/schedule1-test-data.ts.';

async function getDraft(
  request: APIRequestContext,
  millId: number,
  year: number,
): Promise<{ trackStatus: string; editable: boolean }> {
  const url = scheduleUrl(millId, year);
  const res = await request.get(url);
  expect(
    res.ok(),
    `[preflight] Schedule 1 anchor ${millId}/${year} — GET ${url} returned HTTP ${res.status()}. ${REGROUND}`,
  ).toBeTruthy();
  return res.json();
}

test('preflight: Schedule 1 read-only anchor resolves (editable Draft)', async ({ request }) => {
  const doc = await getDraft(request, READONLY_ANCHOR.millId, READONLY_ANCHOR.year);
  expect(
    doc.trackStatus,
    `[preflight] read-only anchor ${READONLY_ANCHOR.millId}/${READONLY_ANCHOR.year} is not a Draft. ${REGROUND}`,
  ).toBe('D');
});

test('preflight: Schedule 1 mutable target resolves (editable Draft)', async ({ request }) => {
  const doc = await getDraft(request, MUTABLE_DRAFT.millId, MUTABLE_DRAFT.year);
  expect(
    doc.editable && doc.trackStatus === 'D',
    `[preflight] mutable target ${MUTABLE_DRAFT.millId}/${MUTABLE_DRAFT.year} must be an editable Draft ` +
      `(the S01 save test writes here and restores it). ${REGROUND}`,
  ).toBeTruthy();
});
