# Defects — UC-SCH3-001 Report Forest Management Administration Costs (Schedule 3)

> How this log works (registers, tags, glossary): [defects-guide.md](../../../defects-guide.md)

All findings below were reproduced on the local seeded delivery DB
(`THE/…@localhost:1525/DBDOCK_01`), app repo branch `test/schedule-3-e2e`, commit `f70cc46`,
2026-08-25.

**Bug / Regression:** _none._

**Divergences:**

- **DIV-1 — a reporter cannot START a Schedule 3: 87 mill-years that require one cannot be entered at all.**
  - **What's wrong:** In the old system, opening Schedule 3 for a mill and year that had never been
    filled in gave you an empty form to type into, and the schedule came into existence when you first
    hit Save. In the new system that mill-year shows the error **"Schedule not found."** and no form at
    all — there is no way to start a Schedule 3 from the screen.
  - **Expected vs actual:** Expected — an empty, enterable Schedule 3 (legacy showed ERR-004 "Schedule
    not found." only when the mill-year had no reporting context at all). Actual — HTTP 404 "Schedule
    not found." on every Schedule 3 operation for that mill-year, and the page renders the error banner
    with the form suppressed.
  - **How big is it (measured on the delivery extract, 2026-08-25):** the extract marks Schedule 3 as
    **required** for 118 mill-years (`ILCR_REPORT_CATEGORY` rows with category `'3'`) but only **31**
    have ever been started (`ILCR_REPORT_SUMMARY` rows with category `'3'`). **87 of those are on a
    Draft track**, i.e. they are exactly the mill-years a reporter is supposed to be able to fill in
    today. None of them can be.
  - **How we caught it (verified on real data 2026-08-25):** probed `GET /api/v1/schedule3` for every
    mill × reporting year (357 requests): 28 answer 200, 322 answer 404, 7 answer 409 (closed mill). Of
    the 98 pairs on a Draft track only 15 open Schedule 3. Reproduced through the browser on mill 8888
    (millId 24051) / 2015 — a Draft mill-year whose `ILCR_REPORT_CATEGORY` row says Schedule 3 IS
    required. Read-only: nothing was written.
  - **Why (technical):** `Schedule3Service` resolves the category-3 `ILCR_REPORT_SUMMARY` before doing
    anything and throws `ScheduleNotFoundException` when it is absent — on the read
    (`Schedule3Service.java:170`) and on every write via `requireEditableSummary` (`:1070`), including
    both sub-resources and check-status. Legacy created that row on the first Save, which is what
    `Schedule3MB.isScheduleOpen()` reported on. This is **not** an app-wide convention: Schedule 2's
    save inserts its own summary (`Schedule2Repository:200`, `MERGE INTO … ILCR_REPORT_SUMMARY`).
  - **Is it a defect?** It looks like one, but it could be an intentional decision that a schedule is
    created by some other process. BA/QA to decide. Worth asking specifically: *is something else meant
    to create these rows before a reporter opens the screen?*
  - **Action:** **BA/QA to raise a Jira ticket.** Kept as a genuinely-failing `@discovered-divergence`
    test that asserts the correct behaviour (an enterable form) and writes nothing — RED until the app
    matches or the expectation is formally changed.
  - **Knock-on effect on this suite:** because a Schedule 3 cannot be created through the app, this
    suite cannot create its own test data either. `real-test-data-patches/sch3/draft-anchors.sql` seeds
    the one row legacy's first Save would have written on 15 mill-years. **If DIV-1 is fixed, most of
    that patch can be retired** and the scenarios can create their own schedules.
  - **Priority / env:** p0 · branch `test/schedule-3-e2e` · local seeded DB · commit `f70cc46`.
  - **Status:** OPEN. Found 2026-08-24.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/no-create.feature` (S16,
    `@discovered-divergence`).

- **DIV-2 — the "Override Harvest / Total PO&P" switch silences MORE checks than the spec describes.**
  - **What's wrong:** Setting Override to **Yes** is documented as switching off one specific
    consistency check — "Harvest must be at least PO&P" — for the itemized *other-acceptable* cost rows
    only. In the app it also switches that check off for all eleven **fixed** cost lines, so a schedule
    with a genuine Harvest-below-PO&P error on a fixed line reports "All requirements for this schedule
    have been met".
  - **Expected vs actual:** Expected (legacy sidecar BR-10, and the legacy Gherkin S12) — the
    suppression applies to the other-acceptable rows. Actual — it applies to every line: a seeded
    schedule whose Wages/Salaries Harvest is 40,000 against a PO&P of 50,000 passes Check Status
    outright once Override is "Y".
  - **How we caught it (verified on real data 2026-08-25):** two seeded read-only anchors that differ
    ONLY in the Override flag. `POST /api/v1/schedule3/check-status` on mill 20171/2020 (Override "N")
    returns one error — `Wages/Salaries, incl Benefits (Harvest Total $): Value must be greater than or
    equal to the corresponding PO&P Cost`. The same request on mill 20171/2021 (Override "Y", same
    amounts plus an other-acceptable row that also violates the rule) returns
    `requirementsMet: true` and **zero** errors. Nothing was written to either.
  - **Why (technical):** `Schedule3Service.appendFixedLineCheckErrors` guards the BR-03 comparison with
    `if (!override && …)`, so the flag gates the fixed-line loop as well as
    `appendOtherAcceptableCheckErrors`. The code comment cites a legacy
    `Schedule3CheckStatus.isHarvestCostGreaterThanPopCost` as gating all lines — which, if right, would
    make the legacy sidecar the thing that is wrong.
  - **Is it a defect?** Can't tell from the test alone: either the app over-applies the override, or the
    requirements sidecar under-describes it. The two sources disagree and only a look at the legacy
    source can settle it. BA/QA to decide.
  - **Action:** **BA/QA to raise a Jira ticket** (or correct the sidecar). **No RED test:** the legacy
    slice's own assertion — the other-acceptable row is not flagged — *passes*, so forcing a failure
    here would be asserting something the spec never said. The wider suppression is instead pinned
    explicitly in the same scenario (the fixed line is asserted NOT flagged, and the schedule is
    asserted to pass), so whichever way BA/QA rule, the test documents today's behaviour and will fail
    the moment it changes.
  - **Priority / env:** p1 · branch `test/schedule-3-e2e` · local seeded DB · commit `f70cc46`.
  - **Status:** OPEN. Found 2026-08-25.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/check-status.feature` (S12, GREEN — see
    Action).

- **DIV-3 — the "save the schedule before opening the cost sub-pages" warnings no longer exist.**
  - **What's wrong:** The old system refused to open either cost sub-page until the schedule had been
    saved once, warning "The schedule has to be saved before opening other costs" (and the equivalent
    for unacceptable costs). The new system always lets you in.
  - **Expected vs actual:** Expected (legacy ALT-002 / ALT-003, slices S18 and S19, rule BR-08) — a
    browser alert and no navigation. Actual — the count links always work; on an editable schedule they
    first ask "Any unsaved data will be lost…" (a Carbon modal), and on a read-only schedule they open
    straight through. The per-row delete on a sub-page has likewise lost its confirmation prompt: the
    trash icon persists immediately.
  - **How we caught it (verified on real data 2026-08-25):** both links are asserted present and usable
    on a read-only (Submitted) schedule, and the sub-page rows are asserted read-only there; on an
    editable schedule every sub-page entry crosses the discard-unsaved-edits modal, whose verbatim text
    is asserted. Removing a row returns "Data deleted successfully" with no intervening prompt.
  - **Why (technical):** the gate was `!schedule3MB.isScheduleOpen()` — "the schedule has never been
    saved". The rewrite has no such state: a Schedule 3 that can be opened at all already exists (see
    DIV-1), so the condition is unreachable by construction. The row-level confirm was dropped by the
    shared `EditableSubPage` rewrite, which is the same change Schedule 1 already carries.
  - **Is it a defect?** Probably not — the guarantee legacy wanted (don't lose in-progress data) is met
    a different and arguably better way, by the discard-unsaved-edits modal. But the *data-loss* risk on
    the row delete is real: an accidental trash-icon click is persisted immediately with no undo. BA/QA
    to decide whether that needs a confirm.
  - **Action:** No `@discovered-divergence` test. This is recorded as an **accepted re-grounding** for
    the sub-page gate (S18/S19 are dispositioned `not-applicable` in coverage.md and cannot be
    reproduced), and the assertions above pin the replacement behaviour so a regression is visible. The
    missing row-delete confirm is the one part BA/QA may want ticketed.
  - **Priority / env:** p2 · branch `test/schedule-3-e2e` · local seeded DB · commit `f70cc46`.
  - **Status:** OPEN. Found 2026-08-24.
  - **Test:** `render-states.feature` (S15 + the read-only sub-page scenario) and `other-costs.feature`
    (S04) — both GREEN.

- **DIV-4 — the "Included Unacceptable Costs (n)" count includes Annual Rents, so it reads one higher
  than the number of rows on the sub-page.**
  - **What's wrong:** The link on Schedule 3 says "Included Unacceptable Costs (2):" when the sub-page
    behind it lists only **one** row. The extra 1 is the Annual Rents amount typed on the main page,
    which is treated as an unacceptable cost but is not a row on the sub-page.
  - **Expected vs actual:** Expected (legacy CNT-001) — the count is the itemized row list
    (`schedule3.numberOfUnacceptableCosts`). Actual — the row count plus 1 whenever the Annual Rents
    Harvest amount is present and non-zero.
  - **How we caught it (verified on real data 2026-08-25):** on mill 727/2020, seeded with an Annual
    Rents Harvest of 5,000 and no itemized rows, the link reads "(1):" while the sub-page shows "No
    records found."; after adding one row it reads "(2):" with one row listed. The sub-page's own Totals
    figure behaves the same way — 11,500 = the 6,500 row + the 5,000 Annual Rents.
  - **Why (technical):** `Schedule3Service` computes `unacceptableCount = item-38 rows + (annualRents
    != null && != 0 ? 1 : 0)`, and the sub-page subtotal adds the Annual Rents cost in the same way
    (mirroring the legacy `Schedule3DO.getUnaccecptableCostsTotals`, which also included it).
  - **Is it a defect?** Probably not — the *money* total demonstrably included Annual Rents in legacy
    too, so counting it is consistent. But it is confusing on screen (a count that does not match the
    list), and the legacy sidecar describes the count as the row list. BA/QA to decide whether the label
    should change.
  - **Action:** No `@discovered-divergence` test — the app's arithmetic is self-consistent and the
    scenario asserts it explicitly (both the "(1)" with no rows and the "(2)" with one), so the
    behaviour is pinned either way. BA/QA to confirm the count is intended to include Annual Rents.
  - **Priority / env:** p2 · branch `test/schedule-3-e2e` · local seeded DB · commit `f70cc46`.
  - **Status:** OPEN. Found 2026-08-25.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/unacceptable-costs.feature` (S05, GREEN).

**Coverage gaps (not tested yet — no app problem):**

- **GAP-1 — "the schedule is read-only because you are not a Licensee" cannot be tested (BR-01, S15).**
  - **Why not:** the local stack runs with security off — a mock principal grants one role with every
    action — so there is no way to be signed in *without* `EDIT_SCHEDULE`. The read-only half of BR-01
    that depends on the **track status** IS covered (both Submitted and Verified); only the
    role-dependent half is unreachable. The server-side gate itself exists and is covered by the
    backend's own `Schedule3AuthorizationIT` / `Schedule3WriteAuthorizationIT`.
  - **Future action:** revisit as E2E once the environment can issue a reader-only principal; a gate
    should treat this as **waived**, not failing.
  - **Status:** OPEN.
  - **Test:** none — tracked as a `blocked` row in coverage.md.

- **GAP-2 — the optimistic-lock conflict (two people saving the same Schedule 3) is not covered.**
  - **Why not:** it is a rewrite-only guarantee (AR11: a stale `revisionCount` is refused with HTTP 409)
    with no counterpart in the legacy Gherkin, so no slice asks for it. It is genuinely worth an E2E —
    Schedules 4 and 11 both have one — but it needs a dedicated anchor, and Schedule 3's anchors are
    currently seeded one-per-scenario (see DIV-1's knock-on note), so adding it costs a new patched
    mill-year rather than a new scenario.
  - **Future action:** add a `concurrency.feature` (open two contexts, save both, assert the second is
    refused and nothing is lost) when the next Schedule 3 work lands — or for free once DIV-1 is fixed
    and scenarios can create their own schedules.
  - **Status:** OPEN.
  - **Test:** none — tracked as a `deferred` row in coverage.md.

- **GAP-3 — the sub-page "discard unsaved edits" prompt on Back is not asserted.**
  - **Why not:** the equivalent prompt on the way IN to a sub-page IS asserted (every navigation
    crosses it, and its verbatim text is checked). The Back-with-unsaved-edits variant needs a scenario
    that deliberately leaves a row edited and then walks away, which only fits on the one mutating
    sub-page anchor whose scenario is already the longest in the suite.
  - **Future action:** cover it as its own scenario when a second sub-page anchor exists.
  - **Status:** OPEN.
  - **Test:** none — tracked as a `deferred` row in coverage.md.

**Spec gaps (the Gherkin is missing scenarios its own docs list):** _none._ The 24 slices reconcile
cleanly against the slice catalogue's own Gap Analysis (62 fields, 11 business rules, 5 preconditions,
4 combinations) and against the technical sidecar's message catalog. Every item that catalogue
deliberately excluded was re-checked against the new app rather than inherited — see coverage.md,
"Deliberately excluded by the slice catalogue".

**Verified — not a defect:**

- **The Crown column, both subtotals and all three $/m³ figures move as you type, before Save.** This
  looked like the derived figures being computed on the client (which would contradict "the server owns
  every stored figure"). It is a deliberate display-only mirror added for defect #291 so the read-only
  cells track entry the way legacy's per-field AJAX did; the Save response replaces every figure, and
  nothing derived is ever sent on a write. The happy path asserts the mirror *before* Save and the
  server's own figures *after* it, so the two can never silently diverge. (Verified 2026-08-25.)

- **Scaling Expense shows a PO&P amount nobody typed.** Its PO&P is derived server-side from the two
  timber volumes — `round(popTimberVolume ÷ (popTimberVolume + crownTimberVolume) × scalingHarvest)`,
  3,750 for the happy path's 50,000 / 150,000 / 15,000 — and is deliberately read-only. Legacy did the
  same (`Schedule3DO.getScalingExpense`); it is not a stray write. (Verified 2026-08-25.)

- **Annual Rents and Silviculture Admin Costs show a blank PO&P cell while the API returns 0.** Legacy
  captured no PO&P for those two lines at all (BR-04, a hidden input), so the page renders an em dash
  rather than the backend's 0 — showing "0" would claim a value the reporter never entered. Both the
  blank cell and the absent input are asserted. (Verified 2026-08-25.)

- **A mis-grouped number like "9,9,9" is accepted as 999.** Found while probing for a non-numeric
  rejection. The page strips every comma before parsing, so mis-grouped digits pass; the app's own
  stricter `parseDecimalInput` (used for the derived-figure mirror) would reject them. Legacy's
  `DecimalFormat.parse` was laxer still — it silently accepted junk suffixes — so this is not a
  regression, and the genuinely non-numeric case IS covered. (Verified 2026-08-25.)

- **The suite's cross-domain anchor guard was passing without checking most anchors.** While adding
  Schedule 3, `preflight/sch4-anchors.setup.ts`'s "Cross-domain anchors are globally distinct" check
  reported only one of this domain's 15 shared mill-years. It matched only the object-literal
  `{ millId, year }` form, so it had never seen sch4's own 48 table anchors either (they use the
  positional `at(MILL_x, id, year)` builder). The scan now covers both forms and every deliberate share
  is declared with its reason. This is the same silent-under-scanning class as that file's own VER-8
  note, one level down — worth remembering as a pattern, not just a fix. (Verified 2026-08-25.)
