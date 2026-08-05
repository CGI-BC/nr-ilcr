import { test, expect, type APIRequestContext } from '@playwright/test';
import { MUTABLE_DRAFT, READONLY_ANCHOR, scheduleUrl } from '../fixtures/sch1/schedule1-test-data';

/** Line-item / silviculture / summary shape needed to prove the mutable target starts EMPTY. */
type ScheduleDoc = {
  trackStatus: string;
  editable: boolean;
  lineItems?: Array<{ volume: number | null; cost: number | null }>;
  silviculture?: {
    actualSpent?: { volume: number | null; cost: number | null };
    accruedLessActual?: { volume: number | null; cost: number | null };
  };
  otherCosts?: { count?: number };
  otherCostsVolume?: number | null;
  forestMgmtAdminVolume?: number | null;
  subtotalCompanyLoggingVolume?: number | null;
};

/**
 * True when a Schedule 1 carries NO report data — every writable value null and no itemized Other-Costs
 * rows. The S01 happy-path cleanup restores the mutable target by blanking every writable field
 * (`emptyScheduleRequest`), which is lossless ONLY if that target was empty to begin with. Preflight
 * asserts this so a re-extract that leaves 13050/2017 Draft-but-POPULATED fails fast here instead of
 * letting S01 silently overwrite real seeded values with blanks.
 */
function isEmptySchedule(doc: ScheduleDoc): boolean {
  const cells = [
    ...(doc.lineItems ?? []).flatMap((li) => [li.volume, li.cost]),
    doc.silviculture?.actualSpent?.volume ?? null,
    doc.silviculture?.actualSpent?.cost ?? null,
    doc.silviculture?.accruedLessActual?.volume ?? null,
    doc.silviculture?.accruedLessActual?.cost ?? null,
    doc.otherCostsVolume ?? null,
    doc.forestMgmtAdminVolume ?? null,
    doc.subtotalCompanyLoggingVolume ?? null,
  ];
  const allValuesNull = cells.every((v) => v === null || v === undefined);
  const noItemizedRows = (doc.otherCosts?.count ?? 0) === 0;
  return allValuesNull && noItemizedRows;
}

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
): Promise<ScheduleDoc> {
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

test('preflight: Schedule 1 mutable target resolves (empty, editable Draft)', async ({ request }) => {
  const doc = await getDraft(request, MUTABLE_DRAFT.millId, MUTABLE_DRAFT.year);
  expect(
    doc.editable && doc.trackStatus === 'D',
    `[preflight] mutable target ${MUTABLE_DRAFT.millId}/${MUTABLE_DRAFT.year} must be an editable Draft ` +
      `(the S01 save test writes here and restores it). ${REGROUND}`,
  ).toBeTruthy();
  // Guardrail against silent seed destruction: S01's cleanup blanks every writable field, which only
  // restores the ORIGINAL state if this target was empty to start with. If a re-extract leaves it
  // populated, fail HERE — do not let S01 run and overwrite real values with nulls.
  expect(
    isEmptySchedule(doc),
    `[preflight] mutable target ${MUTABLE_DRAFT.millId}/${MUTABLE_DRAFT.year} is a Draft but NOT empty. ` +
      `S01's blank-restore would permanently overwrite the seeded values. Pick a different empty ` +
      `editable Draft for MUTABLE_DRAFT (or snapshot/restore it like the delete/retry targets). ${REGROUND}`,
  ).toBeTruthy();
});
