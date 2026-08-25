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
  - **Expected vs actual:** Expected — an empty, enterable Schedule 3. Actual — HTTP 404 "Schedule not
    found." on every Schedule 3 operation for that mill-year, and the page renders the error banner with
    the form suppressed.
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
  - **Is it a defect?** Yes — confirmed, and already ticketed from the Schedule 1 side.
  - **Action:** none needed from QA — the ticket below already covers it. Kept as a genuinely-failing
    `@discovered-divergence` test that asserts the correct behaviour (an enterable form) and writes
    nothing.
  - **Ticket:** [bcgov/nr-ilcr#296](https://github.com/bcgov/nr-ilcr/issues/296) (pre-existing, raised
    from Schedule 1) — *"Schedule 1 and 3: Show empty data set if data does not exist for current mill
    year."* Its title names **both** schedules, so this entry is the Schedule 3 half of the same defect
    rather than a new one — and the fix is expected to land in both pages together.
  - **Knock-on effect on this suite:** because a Schedule 3 cannot be created through the app, this
    suite cannot create its own test data either. `real-test-data-patches/sch3/draft-anchors.sql` seeds
    the one row legacy's first Save would have written on 16 mill-years. **When #296 is fixed, most of
    that patch can be retired** and the scenarios can create their own schedules.
  - **Priority / env:** p0 · branch `test/schedule-3-e2e` · local seeded DB · Chrome.
  - **Status:** OPEN — confirmed and triaged against the pre-existing ticket #296. Dev to fix when
    capacity allows; QA re-verifies and closes this entry then. The `@discovered-divergence` test asserts
    the CORRECT behaviour, so it is RED today and goes green on its own when the fix lands, at which
    point its tag comes off. No test change is needed. Found 2026-08-24.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/no-create.feature` (S16,
    `@discovered-divergence`).

- **DIV-2 — RETRACTED (author error): the Override switch DOES suppress the Harvest≥PO&P check on every
  fixed line in legacy too, so the app is faithful.**
  - **What this entry claimed:** that setting "Override Harvest / Total PO&P" to Yes silences the
    Harvest-must-be-at-least-PO&P check more widely than the spec describes — on all eleven fixed cost
    lines rather than only on the itemized other-acceptable rows — and that BA/QA had to decide whether
    the app or the requirements sidecar was wrong.
  - **Why it is wrong (checked against the legacy application source 2026-08-25, `docs/nr-ilcr-2.0.4`):**
    legacy applies the override to every fixed line, exactly as the app does. The suppression simply does
    not live where I looked:
    - `managedBean/Schedule3MB.checkStatus()` reads a PRE-COMPUTED flag per line
      (`!checkedSchedule3.getLicensesFeesInsurance().isHarvestGreaterThanPop()`), which is why that
      method carries no override guard on the fixed lines and guards only the other-acceptable rows
      (line 312). I read that absence as "legacy did not suppress here".
    - the flag is computed one layer up, in `service/Schedule3CheckStatus.java:35-56`, which calls
      `isHarvestCostGreaterThanPopCost(overrideTotPop, line)` for **each** fixed line — and that method
      (`:64-72`) opens with `if (overrideTotPop) return true;`, an unconditional pass. The same class
      repeats the guard in `isScheduleValid` (`:78-103`) as
      `(!overrideTotPop && !…isHarvestGreaterThanPop())`.
    So the app's `if (!override && …)` in `Schedule3Service.appendFixedLineCheckErrors` reproduces legacy
    precisely. The backend's own code comment cited this class and was right; I discounted it.
  - **What actually misled me:** the requirements sidecar describes BR-10 as applying to the
    other-acceptable rows only, and pairs the override with just the `Subtotal Other Costs (Harvest
    Total $)` row in its check-status table. That is the sidecar being narrower than the code it was
    derived from — a documentation gap, not an app defect. Recorded as **SPEC-1** below so the sidecar can
    be corrected; nothing is wrong with the application.
  - **Method note (worth keeping):** reading the managed bean alone was not enough, because legacy
    computes check-status in a service and the bean only renders the result. "The guard is absent here"
    needs the whole call chain before it is a safe conclusion.
  - **Status:** RETRACTED (author error) 2026-08-25. Raised 2026-08-25, retracted the same day on the
    legacy source, at the repo owner's request to double-check it. The number is retained and never
    reused.
  - **Test:** `check-status.feature` (S12 and its mirror) — GREEN, and unchanged. The scenarios assert
    the app's real behaviour (the other-acceptable row is not flagged, the fixed line is not flagged, the
    schedule passes), which is now confirmed to be correct legacy behaviour rather than a deviation.

- **DIV-3 — the legacy "save the schedule before opening the cost sub-pages" ALERT is gone. The
  navigate-away confirmation it sat beside is NOT — that is preserved.**
  - **Scope corrected 2026-08-25** after the repo owner checked the running app. An earlier version of
    this entry was headed "the warnings no longer exist", which over-claimed: a confirmation IS shown
    before you leave Schedule 3 for a sub-page. Only the *save-first* alert is gone. The per-row delete
    confirmation this entry also used to bundle in is a separate defect, now **DIV-5**.
  - **What's wrong:** legacy refused to open either cost sub-page until the schedule had been saved once,
    warning "The schedule has to be saved before opening other costs" (and the unacceptable-costs
    equivalent). That alert has no counterpart in the new app.
  - **What is NOT wrong — the guarantee is intact:** legacy had TWO controls on those links, not one
    (`webapp/schedule3.xhtml`): an `…EditsEnabledAlert` variant carrying the save-first `alert()`
    (`:265-267`), and an `…EditsEnabled` variant carrying
    `<p:confirm message="#{msg.confirmNavigationMsg}">` (`:270-273`). The rewrite keeps the second: an
    editable schedule shows the "Leave Schedule 3" modal with the verbatim legacy text before navigating.
    This suite asserts that text on **every** sub-page entry (`pages/sch3/schedule3Page.ts`
    `openSubPage`), so its loss would fail the suite immediately.
  - **Why the alert cannot exist here:** it was gated on `!schedule3MB.isScheduleOpen()` — "the schedule
    has never been saved". In the rewrite a Schedule 3 that can be opened at all already exists (that is
    DIV-1), so the condition is unreachable by construction. S18 and S19 are therefore dispositioned
    `not-applicable` in coverage.md rather than covered — the state they describe cannot be produced.
  - **Is it a defect?** No — an accepted re-grounding. The data-loss risk the alert existed to prevent is
    covered by the navigate-away confirm, which is present, asserted, and verbatim. Worth revisiting if
    #296 gives Schedule 3 a create path: an unsaved schedule would become reachable and the save-first
    gate would become meaningful again.
  - **Action:** none. No ticket.
  - **Priority / env:** p2 · local seeded DB · Chrome.
  - **Status:** CLOSED (accepted re-grounding) 2026-08-25. Found 2026-08-24; scope corrected and closed
    2026-08-25 after the repo owner verified the navigation confirm against the running stack and the
    legacy link variants were read at source.
  - **Test:** `render-states.feature` (S15 + the read-only sub-page scenario), plus the navigate-away
    text asserted on every sub-page entry in `pages/sch3/schedule3Page.ts` — all GREEN.

- **DIV-4 — RETRACTED (author error): legacy ALSO adds 1 to the Included Unacceptable count for a
  non-zero Annual Rents amount, so the app is faithful.**
  - **What this entry claimed:** that the "Included Unacceptable Costs (n):" link reads one higher than
    the number of rows on the sub-page because the app adds Annual Rents to the count, where legacy
    counted only the itemized rows.
  - **Why it is wrong (checked against the legacy application source 2026-08-25):**
    `service/domain/Schedule3DO.getNumberOfUnacceptableCosts()` (`:395-403`) carries the literal comment
    *"add 1 to unacceptable costs total if there is a value for annual rent"* and does exactly that —
    `numberOfUnacceptabeCosts = unaccecptableCosts.size();` then `+= 1` when the Annual Rents harvest
    cost is non-null **and** `compareTo(BigDecimal.ZERO) != 0`. The app's
    `unacceptableRows.size() + (annualRentsHarvest != null && annualRentsHarvest != 0 ? 1 : 0)` is the
    same rule, including the same zero test. The money total matches too:
    `getUnaccecptableCostsTotals()` (`:383-388`) adds `getUnaccecptableCostsAnnualRents().getTotalCost()`
    to the row sum, which is exactly what the sub-page's Totals footer shows.
  - **What actually misled me:** the sidecar renders CNT-001 as the bare expression
    `#{schedule3MB.schedule3.numberOfUnacceptableCosts}` without saying what that getter does, so I took
    "the count" to be self-evidently the row count. A count that deliberately does not match the visible
    row list is legacy behaviour — arguably still confusing on screen, but not a divergence, and not this
    suite's call to redesign.
  - **Status:** RETRACTED (author error) 2026-08-25. Raised 2026-08-25, retracted the same day on the
    legacy source, at the repo owner's request to double-check it. The number is retained and never
    reused.
  - **Test:** `unacceptable-costs.feature` (S05) — GREEN, and unchanged. It asserts "(1)" with no rows
    and "(2)" with one row, now confirmed correct legacy behaviour.

- **DIV-5 — removing an itemized cost row on either sub-page deletes it immediately, with no
  confirmation and no undo. Legacy asked first.**
  - **What's wrong:** on both Schedule 3 cost sub-pages each row carries a small trash-can button.
    Clicking it deletes that row and saves the change straight away — one mis-click destroys a recorded
    cost with no prompt and no way back. The old system asked "This will delete the current record. Do
    you want to continue?" first.
  - **Expected vs actual:** Expected a confirm-before-delete prompt, then the delete (legacy
    `confirmDeleteMsg`). Actual — the row disappears on click, the whole row set is persisted via one
    `PUT …?intent=delete`, and the API's "Data deleted successfully" is echoed afterwards.
  - **How we caught it (verified on real data 2026-08-25):** re-grounding S04. Removing the added row on
    the Other Costs sub-page returns SUC-002 with no dialog rendered at any point.
  - **Why (technical):** the trash button's `onClick` goes straight to `useEditableCostRows.removeRow` →
    `persist(next, 'delete')` (`hooks/useEditableCostRows.ts:270-283`); no dialog is involved. The
    behaviour lives in the SHARED `EditableSubPageLayout` / `useEditableCostRows` components rather than
    on the Schedule 3 pages — so the defect is shared, and so is the fix.
  - **Is it a defect? Yes — confirmed against the legacy application source (2026-08-25), not just the
    sidecar.** `webapp/schedule3SubtotalOtherCosts.xhtml:94-96` — the per-row Delete is a
    `p:commandButton` carrying
    `<p:confirm header="Confirmation" message="#{msg.confirmDeleteMsg}" icon="ui-icon-alert" />`. Legacy
    did prompt. The new app is also **internally inconsistent**: the whole-schedule Delete kept its
    "Delete schedule" confirm modal, so the app confirms the large destructive action and not the small
    one.
  - **The same defect as Schedule 1's, one component deeper:**
    `features/sch1/uc-sch1-001-enter-save/defects.md` **DIV-3** records it for Schedule 1's Other Costs
    sub-page and is OPEN pending exactly this check — its "Next step" asks the dev to confirm the prompt
    against legacy, because the sidecar is captured source rather than the running system. The legacy
    source above answers that for Schedule 3's sub-page, and Schedule 1's is the same `p:confirm` idiom on
    the same shared rewrite. Worth resolving as ONE ticket across both schedules rather than two.
  - **Action:** **BA/QA to raise a Jira ticket** (or fold it into Schedule 1 DIV-3's, once that has one).
    Kept as a genuinely-failing `@discovered-divergence` test that asserts the prompt appears and the row
    survives until it is confirmed — RED until the confirmation is restored. The test asserts that a
    confirmation is *shown*, not any particular chrome, so any reasonable implementation satisfies it
    (the repo already has `components/core/ConfirmDeleteModal` for exactly this).
  - **Priority / env:** p1 · branch `test/schedule-3-e2e` · local seeded DB · Chrome.
  - **Status:** OPEN. Found 2026-08-24 (bundled inside DIV-3), split out and legacy-source-confirmed
    2026-08-25 at the repo owner's direction.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/row-delete-confirm.feature` (S04,
    `@discovered-divergence`).

- **DIV-6 — Check Status judges the SAVED schedule and silently ignores what is on screen. Legacy judged
  the screen. Affects 11 of the 12 schedules.**
  - **What's wrong:** change something — the Override switch, any amount — and press Check Status without
    saving, and the answer describes the *stored* schedule, not the one in front of you. Nothing says so.
    Reported by the repo owner 2026-08-25: selecting "No" for Override Harvest ⁄ Total PO&P and pressing
    Check Status shows no errors; pressing Save first and then Check Status shows them.
  - **Expected vs actual:** Expected — the verdict describes the screen (legacy). Actual — the verdict
    describes the last saved state; with Override stored as "Y" the two stored BR-03 violations stay
    suppressed and the page still reports "All requirements for this schedule have been met" even after
    the reporter has switched Override to "No" on screen. A **false green**: the schedule is declared
    ready while the screen says otherwise. The mirror case is just as bad — fix a flagged field, press
    Check Status, and the same error is still reported.
  - **How we caught it (verified on real data 2026-08-25):** the repo owner found it by hand; reproduced
    as a scenario on the seeded `check-override` anchor (mill 20171/2021, Override "Y" + a stored
    Wages/Salaries 40,000-vs-50,000 violation + an other-acceptable 1,000-vs-2,500 violation). Check
    Status passes; switching Override to "No" on screen and re-checking still does not report either
    violation. Read-only — nothing is saved, and the unmoved optimistic-lock token is asserted to prove
    it.
  - **Why (technical):** the request carries no client state, by contract.
    - `POST /api/v1/schedule3/check-status` declares only `@RequestParam millId` and `@RequestParam year`
      — **no `@RequestBody`** (`Schedule3Api.java:85-87`).
    - the client posts no payload: `useScheduleMutations.checkStatus` is
      `api().post(url(suffix))` with no second argument (`useScheduleMutations.ts:77-78`).
    - the service therefore reads the database: `repository.findSummary(...)`,
      `repository.findDetails(...)`, and `override = OVERRIDE_YES.equals(summary.location())`
      (`Schedule3Service.java:889-895`).
  - **Legacy could not behave this way.** Its Check Status button was `ajax="false"`
    (`webapp/schedule3.xhtml:38` and `:421`) — a full form postback. JSF applied every submitted field to
    the bean during UPDATE_MODEL_VALUES *before* `checkStatus()` ran, including `overrideTotPopVal`, which
    is bound straight to `#{schedule3MB.schedule3.overrideTotalPop}` (`:323-324`). `checkStatus()` then
    validated that in-memory object (`Schedule3MB.java:158-159` →
    `ilcrService.schedule3CheckStatus(schedule3)`) and persisted nothing. So legacy evaluated the screen
    without saving it. (Legacy's *separate* consolidated Check Status page, `CheckStatusMB` /
    `checkStatus.xhtml`, is the one that reads stored data — that is the submit gate, a different
    surface.)
  - **The false green, captured from the failing run's DOM snapshot (2026-08-25):** at the moment of
    failure the page holds both of these at once —
    `row "Override Harvest ⁄ Total PO&P $ … No"` (the dropdown reads **No** on screen) and
    `status: text: Requirements met All requirements for this schedule have been met`. Two BR-03
    violations are stored. So the reporter is told the schedule is ready while looking at the switch that
    should be exposing both of them.
  - **The team has already ruled on this rule, and fixed it once.**
    `docs/superpowers/specs/2026-08-21-schedule-6-corrections-design.md:54-58` — *"Check Status evaluates
    the submitted on-screen values, not the database. Legacy's Check Status was an `ajax="false"` full
    postback that populated the managed bean from the screen and evaluated that, persisting nothing. The
    shipped implementation reads the DB, which was near-equivalent while an Edit button meant at most one
    row could be unsaved; with correction 4 the two diverge on every keystroke."* That reasoning applies
    with MORE force to Schedule 3, whose whole form is editable at once — there is no Edit button
    limiting the unsaved surface to one row, so screen and database diverge on the first keystroke.
  - **Existing tickets searched (2026-08-25):** no open or closed issue covers this root cause.
    Adjacent but distinct: **#326** (Schedule 4's Check Status messages omit the field name), **#322**
    (Check Status should be disabled outside Draft on Schedules 4 and 8), and **#293** (CLOSED — added
    the bottom-row Check Status button on Schedules 4 and 6). None of them concerns WHICH data the check
    evaluates.
  - **Is it a defect? Yes — and the repo already says so in its own words.** Schedule 6 is built the
    other way and documents the rule: "`request` carries the on-screen values (Task 6): legacy's
    `ajax="false"` postback applied the screen to the model before evaluating
    (`Schedule6MB.checkStatus` :139-140), so **the verdict must describe the screen, not the database**"
    (`Schedule6Api.java:100-103`). Its endpoint takes `@Valid @RequestBody Schedule6CheckRequest` and its
    page posts a body (`components/schedule6/index.tsx:754`). So this is not a matter of interpretation:
    one schedule implements the rule and eleven do not.
  - **Scope — 11 of 12 schedules (wire contract verified for all; end-to-end proven for Schedule 3):**

    | Schedule | check-status request | Verdict |
    |---|---|---|
    | 6 | `@RequestBody Schedule6CheckRequest`, page posts a body | **correct — the precedent for the fix** |
    | 1, 2, 3, 4, 5, 8 | no body; shared `useScheduleMutations.checkStatus` posts no payload | affected |
    | 7a, 7b, 9, 10, 11 | no body; each page's own `.post(CHECK_STATUS_PATH + query)` with no second argument | affected |

    Schedule 8 has a second surface with the same shape — its sample sub-page posts
    `/v1/schedule8/pages/{pageId}/check-status?…` with no body (`schedule8/SamplePage.tsx:239-244`).
  - **What this entry does NOT claim.** For Schedule 3 the behaviour is proven end-to-end by the failing
    scenario. For the other ten, only the *wire contract* was read — an endpoint that receives no client
    state cannot evaluate one, which is sufficient for the defect, but two page-level details were not
    checked per schedule: whether each page can actually be dirty at the moment Check Status is pressed,
    and whether it discards a previously-rendered verdict when the user edits (7a, 7b and 9 carry a
    comment saying they do, which would reduce the false-green window without fixing the underlying
    evaluation). Worth a look per page when the ticket is picked up.
  - **Action:** **repo owner is raising ONE ticket covering every affected schedule** (draft prepared
    2026-08-25 in the Bugfix Task house style). Kept as a genuinely-failing test on Schedule 3, asserting
    the correct behaviour — RED until the verdict describes the screen. The fix has a working in-repo
    model to copy (Schedule 6): send the on-screen values and evaluate those.
  - **Register — CONFIRMED as a Divergence (repo owner, 2026-08-25).** I had flagged this as arguably
    belonging in Bug / Regression, since behaviour legacy had was lost. The repo owner ruled it stays a
    Divergence and is to be framed as such: the rewrite made a structural choice (a stateless
    check-status endpoint) that differs from legacy's postback model, and the ticket says so in those
    terms. So the id stays `DIV-6` and the scenario keeps `@discovered-divergence`.
  - **Ticket:** [bcgov/nr-ilcr#359](https://github.com/bcgov/nr-ilcr/issues/359) — *"Check Status should
    evaluate the on-screen values, as legacy did — 11 of 12 schedules evaluate the saved record instead"*,
    labelled `bug`, filed by the repo owner 2026-08-25. (An earlier attempt, **#358**, was filed with `gh`
    and is CLOSED: filing through the CLI bypasses the Bugfix Task template, so no label was applied and
    this account cannot add one. File through the web form.) The filed issue deliberately omits three
    things this entry keeps, as the register is their home: the DOM/request evidence dump, why the suite
    missed the defect, and the related-ticket comparison.
  - **Priority / env:** p1 · branch `test/schedule-3-e2e` · local seeded DB · Chrome.
  - **Status:** OPEN — confirmed and triaged by raising a ticket. Dev to send the on-screen values with the
    check-status request and evaluate those, following Schedule 6 (`Schedule6CheckRequest`), across the
    eleven affected schedules; QA re-verifies and closes this entry then. The `@discovered-divergence`
    scenario asserts the CORRECT behaviour, so it is RED today and goes green on its own when the fix
    lands, at which point its tag comes off. No test change is needed. Found 2026-08-25 by the repo owner;
    legacy-source-confirmed and scoped across the app the same day.
  - **Test:** `features/sch3/uc-sch3-001-report-admin-costs/check-status-unsaved.feature` (S12,
    `@discovered-divergence`).

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

**Spec gaps (the Gherkin is missing scenarios its own source docs list):**

- **SPEC-1 — the sidecar describes BR-10 (the Override switch) as narrower than the legacy code it was
  derived from.**
  - **What's missing:** `UC-SCH3-001-technical.md` and `-detailed.md` both state BR-10 as "when Override
    Harvest/Total PO&P is set to Yes, the Harvest-greater-than-or-equal-to-PO&P check on the
    **other-acceptable costs** is not enforced", and the check-status table pairs the override only with
    the `Subtotal Other Costs (Harvest Total $)` row. S12 is written to match. In the legacy application
    the override suppresses that check on **every fixed cost line as well** —
    `service/Schedule3CheckStatus.java:35-56` computes each line's flag through
    `isHarvestCostGreaterThanPopCost(overrideTotPop, line)`, which returns `true` unconditionally when
    the override is on (`:64-72`).
  - **The app is correct:** `Schedule3Service.appendFixedLineCheckErrors` reproduces the legacy rule
    exactly; we covered it anyway (S12 asserts the fixed line is not flagged and the schedule passes).
    A paperwork mismatch, not a bug — and the reason **DIV-2** was raised and then retracted.
  - **Future action:** a BA corrects BR-10's wording in the technical and detailed sidecars (and, if the
    slice catalogue is regenerated, S12's own description) so the next reader is not sent down the same
    path.
  - **Status:** OPEN. Found 2026-08-25.
  - **Test (covers it anyway):** `check-status.feature` (S12 and its mirror) — GREEN.

The 24 slices otherwise reconcile
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
