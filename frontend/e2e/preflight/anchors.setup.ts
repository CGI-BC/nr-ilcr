import { test, expect, type APIRequestContext } from '@playwright/test';
import { MUTABLE_DRAFT, READONLY_ANCHOR, scheduleUrl } from '../fixtures/sch1/schedule1-test-data';

/** A Schedule 1 fixed line item as it appears in the GET response (backend `Schedule1Response.LineItem`). */
type ResponseLineItem = { costItemCode: number; volume: number | null; cost: number | null };

/**
 * The GET (`Schedule1Response`) shape — the fields needed to prove the mutable target starts EMPTY.
 * NOTE: read the RESPONSE shape, not the PUT request shape. The request's top-level `otherCostsVolume`
 * / `forestMgmtAdminVolume` / `subtotalCompanyLoggingVolume` do NOT exist on the response — the shared
 * Other-Costs volume is `otherCosts.volume`, and 143/144 are rows inside `lineItems`.
 *
 * Mirror of the fields we use from frontend/src/interfaces/Schedule1Response.ts — keep in sync.
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

/**
 * List the fields that make the mutable target non-empty in a way that MATTERS for S01 — i.e. the fields
 * S01's cleanup (`emptyScheduleRequest`) actually blanks: `comments`, line items 12–18 (volume + cost),
 * silviculture actualSpent(1) / accruedLessActual(2) (volume + cost), plus any itemized Other-Costs rows
 * (S01 asserts `count === 0` and never touches them, so a stale row breaks its precondition). A non-empty
 * result is a genuine data-loss / precondition risk → preflight fails.
 *
 * DELIBERATELY NOT checked — the volume-only, server-null-guarded fields S01 neither writes nor restores:
 * line items 143/144, silviculture lessAdmin(139) / total(140), and the shared Other-Costs(19) volume.
 * The backend null-guards these on write (Schedule1Service ~324-405) and `emptyScheduleRequest` sends
 * them null / omits them, so S01 CANNOT overwrite them — a value there is irrelevant to S01's safety.
 * (Our pinned 13050/2017 legitimately carries a shared item-19 volume; checking it only produced noise.)
 * Cost on 143/144/139/140 is likewise ignored — it is pulled from Schedule 3 / derived server-side.
 */
function nonEmptyWritableFields(doc: ScheduleDoc): string[] {
  const items = doc.lineItems ?? [];
  const byCode = (code: number): ResponseLineItem | undefined =>
    items.find((li) => li.costItemCode === code);
  const present = (v: number | null | undefined): boolean => v !== null && v !== undefined;
  const s = doc.silviculture;

  const findings: string[] = [];
  if (doc.comments?.trim()) findings.push('comments');
  for (const code of [12, 13, 14, 15, 16, 17, 18]) {
    const li = byCode(code);
    if (li && (present(li.volume) || present(li.cost))) findings.push(`lineItem ${code} (vol/cost)`);
  }
  if (present(s?.actualSpent?.volume) || present(s?.actualSpent?.cost))
    findings.push('silviculture actualSpent(1)');
  if (present(s?.accruedLessActual?.volume) || present(s?.accruedLessActual?.cost))
    findings.push('silviculture accruedLessActual(2)');
  if ((doc.otherCosts?.count ?? 0) !== 0)
    findings.push(`otherCosts.count=${doc.otherCosts?.count} (itemized rows present)`);
  return findings;
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
  const at = `${MUTABLE_DRAFT.millId}/${MUTABLE_DRAFT.year}`;
  expect(
    doc.editable && doc.trackStatus === 'D',
    `[preflight] mutable target ${at} must be an editable Draft ` +
      `(the S01 save test writes here and restores it). ${REGROUND}`,
  ).toBeTruthy();

  // Guardrail against silent seed destruction. S01 writes here and its cleanup blanks the writable
  // fields, lossless ONLY if the target started empty in those fields. Fail fast if any are populated.
  // (Volume-only null-guarded fields S01 never touches — 143/144/139/140/item-19 — are intentionally
  // NOT checked; see nonEmptyWritableFields.)
  const populated = nonEmptyWritableFields(doc);
  expect(
    populated.length === 0,
    `[preflight] mutable target ${at} is a Draft but NOT empty at: ${populated.join(', ')}. S01's ` +
      `blank-restore would overwrite these real seeded values (or a stale itemized row breaks its ` +
      `count:0 precondition). Pick a different empty editable Draft for MUTABLE_DRAFT, or snapshot/` +
      `restore it like the delete/retry targets. ${REGROUND}`,
  ).toBeTruthy();
});
