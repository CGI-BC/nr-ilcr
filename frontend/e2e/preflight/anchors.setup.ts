import { test, expect, type APIRequestContext } from '@playwright/test';
import { MUTABLE_DRAFT, READONLY_ANCHOR, scheduleUrl } from '../fixtures/sch1/schedule1-test-data';

/** A Schedule 1 fixed line item as it appears in the GET response (backend `Schedule1Response.LineItem`). */
type ResponseLineItem = { costItemCode: number; volume: number | null; cost: number | null };

/**
 * The GET (`Schedule1Response`) shape — the fields needed to prove the mutable target starts EMPTY.
 * NOTE: read the RESPONSE shape, not the PUT request shape. The request's top-level `otherCostsVolume`
 * / `forestMgmtAdminVolume` / `subtotalCompanyLoggingVolume` do NOT exist on the response — the shared
 * Other-Costs volume is `otherCosts.volume`, and 143/144 are rows inside `lineItems`.
 */
type ScheduleDoc = {
  trackStatus: string;
  editable: boolean;
  comments?: string | null;
  lineItems?: ResponseLineItem[];
  // SilvicultureBlock (codes 1/2/139/140); each member is null when its detail row is absent.
  silviculture?: {
    actualSpent?: ResponseLineItem | null; // 1  — volume + cost
    accruedLessActual?: ResponseLineItem | null; // 2  — volume + cost
    lessAdmin?: ResponseLineItem | null; // 139 — volume only (cost pulled from Sch 3)
    total?: ResponseLineItem | null; // 140 — volume only (cost derived)
  };
  // OtherCostsSummary: `volume` is the shared item-19 volume; `count` is the itemized-row count.
  otherCosts?: { volume?: number | null; count?: number };
};

// Which cost-item codes carry a CLIENT-WRITABLE value. 12–18 carry volume + cost; 143/144 (and
// silviculture 139/140) carry volume only — their cost is pulled from Schedule 3 or derived
// server-side (`upsertFixedDetail` writes it null), so a non-null cost is normal on an empty Draft and
// must NOT be read as "populated" (that would false-positive-fail a perfectly good anchor).
const VOL_AND_COST_CODES = new Set([12, 13, 14, 15, 16, 17, 18]);
const VOL_ONLY_CODES = new Set([143, 144]);

/**
 * True when a Schedule 1 carries NO client-entered report data — every writable value null, no itemized
 * Other-Costs rows, and no comment. The S01 happy-path cleanup restores the mutable target by blanking
 * the writable fields (`emptyScheduleRequest`: comments, 12–18, silviculture 1/2), which is lossless
 * ONLY if that target was empty to begin with. Preflight asserts full emptiness so a re-extract that
 * leaves 13050/2017 Draft-but-POPULATED (line item, silviculture, shared Other-Costs volume, OR a
 * comment) fails fast here instead of letting S01 silently overwrite real seeded values with blanks.
 */
function isEmptySchedule(doc: ScheduleDoc): boolean {
  const items = doc.lineItems ?? [];
  const s = doc.silviculture;
  const cells: Array<number | null | undefined> = [
    ...items.filter((li) => VOL_AND_COST_CODES.has(li.costItemCode)).flatMap((li) => [li.volume, li.cost]),
    ...items.filter((li) => VOL_ONLY_CODES.has(li.costItemCode)).map((li) => li.volume),
    s?.actualSpent?.volume,
    s?.actualSpent?.cost,
    s?.accruedLessActual?.volume,
    s?.accruedLessActual?.cost,
    s?.lessAdmin?.volume, // 139 volume only
    s?.total?.volume, // 140 volume only
    doc.otherCosts?.volume, // shared item-19 Other-Costs volume (itemized rows counted below)
  ];
  const allValuesNull = cells.every((v) => v === null || v === undefined);
  const noItemizedRows = (doc.otherCosts?.count ?? 0) === 0;
  const noComments = !doc.comments;
  return allValuesNull && noItemizedRows && noComments;
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
