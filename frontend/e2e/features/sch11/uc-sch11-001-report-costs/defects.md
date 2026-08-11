# Defects — UC-SCH11-001 Report Basic Silviculture Costs (Schedule 11)
> How this log works (registers, tags, per-register templates): [defects-guide.md](../../../defects-guide.md)

**First authored: 2026-08-10** (branch `e2e/schedule-11-e2e-tests`, Story 25.4). Every entry below was
verified against the running app and the seeded local delivery DB on that date — none are carried forward
from another UC on trust.

**Headline: one pre-existing app-wide accessibility bug (re-covered as a deliberate RED), and no
Schedule-11 bugs.** 27 of 28 scenarios pass; the single red is BUG-1 — a critical WCAG defect
in Carbon's validation-error markup that affects every schedule page and is already tracked in
`deferred-work.md`, which explicitly asked for it to be re-covered by a red check here. Schedule 11's own
behaviour was correct on every path exercised, including the four legacy items the requirements could not
pin down. Beyond that bug, what this log records is that **Schedule 11 was rebuilt rather than ported**, so
**four** behaviours genuinely differ from the legacy Gherkin — DIV-1 through DIV-4. They are
logged as **Divergences for BA/QA to confirm as accepted**, not as faults: three trace to decisions already
recorded in Story 25.1/25.2 (AD-8 "render the server's message verbatim", AD-12 the wire contract), while
DIV-4 is a legacy capability with no new-app counterpart and no ticket yet, so it needs its own triage call.
**We are not adjudicating any of them; BA/QA own that call.**

Two further findings were logged as divergences at first and then **disproved** by re-verifying against the
legacy source rather than the derived sidecar. Both now sit in *Verified — not a defect* (**VER-5** the
`ILCR_LICENSEE` rename, **VER-6** the pre-save recompute) so the Divergence register lists only live
differences.

---

## Bug / Regression

- **BUG-1 — Validation errors are never announced to screen-reader users.**
  _Pre-existing · app-wide · not Schedule 11's to fix · already deferred._
  - **What's wrong:** press **Add** with a required field empty and the field turns red with a message
    below it. A sighted user sees it; a screen-reader user is told **nothing**, so the form appears to have
    silently done nothing and there is no way to know which field is at fault.
  - **Evidence:** axe WCAG 2.1 AA scan of the validation-error state, 2026-08-10 — rule
    `aria-valid-attr-value`, impact **critical**, node `#add-location`.
  - **Scope:** the markup comes from `@carbon/react`'s `TextInput` `invalid`/`invalidText` wiring, so
    **every schedule page carries it** (1/2/3/4/8/11). Nothing in Schedule 11 causes it, and it cannot be
    fixed here — it needs an app-wide decision (a visually-hidden `role="alert"` region fed on validation
    failure, or a Carbon version/config change).
  - **WHAT HAPPENS NEXT: nothing, by this story.** It was triaged on 2026-07-30 into
    `_bmad-output/implementation-artifacts/deferred-work.md`, which owns it and names the candidate fixes.
    That note is what asked for the red check below. **No action is owed by Story 25.4.**
  - **Does it block the AC?** No. The epic AC is "violations are zero, **or** each remaining violation is
    triaged with a recorded disposition (NFR1)" — the `deferred-work.md` entry is that disposition.
  - **Priority / env:** p1 · any schedule's field-validation error · local seeded delivery DB.
  - **Status:** **TRIAGED (deferred)** — owned by `deferred-work.md`, awaiting the app-wide accessibility
    decision. **Not ours to close.**
  - **Test:** `accessibility.feature` `@discovered-bug @p1` — a genuine RED that flips green on its own when
    the app-wide fix lands. Excluded from the documented gate:
    `npx playwright test --grep-invert @discovered-bug`.
  - **Why it is a Bug and not a Coverage gap / Divergence:** it is measured against NFR1 (correct
    behaviour), not against legacy — legacy was worse. Being *deferred* is a Status, not a register.

_No OTHER bugs found._ Every write, guard, validation and derived figure behaved as the contract
specifies. For the record, four things were probed directly against the API looking for trouble and each
behaved correctly: a stale `revisionCount` on the inline-edit PUT is rejected with a clean 409 rather than
silently overwriting; a blank-everything POST returns all four required-field messages joined with `"; "`
rather than only the first; costs are stored as whole dollars with the client rounding before send; and a
location with no costs stores real NULLs (which render as blank, not "0").

---

## Divergence

> The app genuinely differs from what the legacy-derived Gherkin describes. **We do not change app source
> to match the spec, and we do not silently drop the spec's version** — each item below is asserted as the
> app actually behaves, and the legacy expectation is recorded here.

- **DIV-1 — Schedule 11 has no "Save" button, and Delete now persists immediately instead of on a later Save.**
  - **NARROWED 2026-08-10 after checking the legacy source directly.** An earlier revision of this entry
    also claimed legacy required a Save click to commit an **Add**. That was WRONG: legacy
    `Schedule11MB.addLocation()` ends with `this.save(saveNewBasicSilv)` (`saveNewBasicSilv = true`), so
    **legacy was add-is-save too** — the trailing Save click in the S01 Gherkin was already redundant
    against legacy (the S01 `.feature` note says as much). Add is therefore NOT a divergence. What follows
    is the part that survives verification.
  - **What's different:** (a) legacy had two page-level **Save** buttons (`btnSaveTop` line 185,
    `btnSave` line 420 of `schedule11.xhtml`) and the new screen has **none**, so every "…then click Save"
    step in the Gherkin has no control to click; (b) **Delete changed from two-phase to immediate.**
  - **The Delete change, precisely:** legacy `deleteLocation()` only sets
    `reportSelected.setDaoTransactionType(DAO_TRANSACTION_TYPE.DELETE)`, re-filters the display list, and
    fires `dataDeletedSuccesfullyInfoMsg` — **without touching the database**. The row was only really
    removed by a subsequent Save. The new app issues `DELETE /locations/{id}` there and then.
  - **How we verified it:** read the legacy source, not just the derived sidecar —
    `Schedule11MB.deleteLocation()` and `addLocation()` quoted above; `btnSaveTop`/`btnSave` ids confirmed
    in `schedule11.xhtml`. New-app side: `components/schedule11/index.tsx` has no page-level Save control;
    `handleAdd` (596) POSTs, `handleSaveEdit` (662) PUTs, `handleDelete` (702) DELETEs. Confirmed
    end-to-end by `persistence.feature` `@S09` (row survives a full reload after Add alone) and
    `delete.feature` `@S07` (row gone from the DB with no further action).
  - **Note the safety direction:** legacy's "Data deleted successfully" appeared while the delete was
    still unpersisted, so navigating away silently kept the row. The new behaviour is strictly safer.
  - **Is it a defect?** Almost certainly not — it is the shipped Story 25.2 contract and it is *safer*
    than legacy (legacy's "Data deleted successfully" appeared while the delete was still unsaved, so
    navigating away silently kept the row). But it changes the user's mental model and removes a familiar
    control, so it needs an explicit product decision rather than our assumption.
  - **Priority / env:** p2 (informational) · local seeded delivery DB.
  - **Status:** OPEN — awaiting BA/QA confirmation that the Add-is-save model is accepted for Schedule 11.
  - **Test:** covered as the app behaves — `happy-path.feature` `@S01`, `inline-edit.feature` `@S03`,
    `delete.feature` `@S07`, `persistence.feature` `@S09`. No red.

- **DIV-2 — When the schedule is read-only, the editing controls are removed rather than greyed out.**
  - **What's different:** Once the silviculture track leaves Draft, legacy **disabled** the six Add
    fields, both Save buttons, both Check Status buttons and every per-row control — they stayed visible
    but unusable. The new screen **does not render** the "Add New Location" panel or the per-row
    Edit/Delete actions at all, and disables the single Check Status button.
  - **Expected vs actual:** S20 expects "the Add New Location panel and its six fields are **disabled**"
    and "every per-row editable field and Delete button … is **disabled**". Actual — they are absent.
  - **How we caught it:** `index.tsx:886` wraps the Add panel in `{editable && …}` and `index.tsx:476`
    does the same for the row actions. Verified on both non-Draft codes — Submitted (12050/2016) and
    Verified (13050/2015).
  - **Is it a defect?** Probably not; hiding an unusable control is usually the better pattern and the
    remaining table is still fully readable and accessible (swept clean by axe). Flagged because it is a
    visible UX difference an auditor comparing screens will notice.
  - **Priority / env:** p2 · local seeded delivery DB.
  - **Status:** OPEN — awaiting BA/QA confirmation that omit-instead-of-disable is accepted.
  - **Test:** `render-states.feature` `@S20` (outline, both codes) asserts absence. No red.

- **DIV-3 — There is one Check Status button, not two.**
  - **What's different:** Legacy rendered a Check Status button above *and* below the table. The new
    screen has one.
  - **Expected vs actual:** S04–S06 locate "the first instance" of the button and S20 asserts "**both**
    Check Status buttons are disabled". Actual — a single button (`index.tsx:881`).
  - **How we caught it:** Locator re-grounding; confirmed in the DOM.
  - **Is it a defect?** Very unlikely — a duplicate control for convenience on a long page. Recorded only
    so the S20 assertion's wording change is traceable.
  - **Priority / env:** p3 (cosmetic) · local seeded delivery DB.
  - **Status:** OPEN — informational; no action expected.
  - **Test:** `render-states.feature` `@S20` asserts the single button is disabled. No red.

- **DIV-4 — The per-field "original value" indicators from legacy do not exist anywhere in the new app.**
  _(NEW 2026-08-10 — found by checking whether Schedule 1's DIV-5 also applies to this screen. It does.)_
  - **What's missing:** in legacy, once a Schedule 11 report had been **submitted** (left Draft), each
    editable field on a location row whose value differed from the previously-saved one displayed a small
    icon button beside it, with a tooltip showing the earlier value — so a reviewer could see at a glance
    what a licensee had changed since the last save, and what it used to be. The new app has nothing
    equivalent.
  - **Legacy evidence (read from `schedule11.xhtml` directly, not the sidecar):** all **six** row fields
    carry the indicator triple — an `h:panelGroup` `{name}OV`, a `type="button"` `p:commandButton`
    `{name}OB` with `rendered="#{report.<field>.is…OriginalVal…(isSubmit)}"`, and a `p:tooltip`
    `{name}TT`/`{name}O` bound to it showing `…Original`. Confirmed ids: `locationOV/OB/TT`,
    `biogeoOV/OB/O`, `enhancedIndicatorOV/OB/TT`, `netaeraOV` + `netAreaOB/O`, `actualCostOV/OB/TT`,
    `plannedCostOB/TT`. Guards: `isLocationOriginalValue(isSubmit)`,
    `isBiogeoClimaticCatalogueOriginalValue(isSubmit)`, `isNetAreaOriginalValue(isSubmit)`,
    `isCostOriginalVal(isSubmit)` — i.e. **they only render once the report has left Draft**.
  - **Why (technical) — missing end to end, not just in the UI:** the API exposes no prior value at all.
    Grepped `schedule11/dto/*.java` and `frontend/src/interfaces/Schedule11Response.ts` for
    `original`/`previous`/`prior`: **no match**. So the frontend could not render the indicator today even
    if someone added the markup. Restoring it needs a backend change.
  - **Is it a defect?** A genuine legacy capability not carried over, in the **post-submission review**
    path — which is why no Draft-focused scenario would ever have caught it. If reviewers/auditors relied
    on it to spot what a licensee changed after submitting, this is a real functional gap; if the audit
    tables now serve that need, dropping it is fine. Same question, same answer needed, as Schedule 1.
  - **Same root cause as Schedule 1's DIV-5** (`features/sch1/uc-sch1-001-enter-save/defects.md`) — the same
    missing capability surfacing on a second screen, not a second defect.
  - **No ticket exists for it, and there may never be one** (confirmed with Iman 2026-08-10). An earlier
    revision of this entry said it "should ride that same ticket"; there is no ticket to ride, so that
    assumption is withdrawn. It needs a triage decision of its own.
  - **Priority / env:** p2 pending triage · local seeded delivery DB.
  - **Status:** OPEN — **BA/QA to triage.** The decision needed is whether losing the post-submission
    change-tracking view matters: if reviewers relied on it to see what a licensee altered after submitting,
    this is a real functional gap needing a backend change (the API exposes no prior value); if the audit
    tables now serve that need, it can be closed as an accepted drop. Cross-referenced to Schedule 1 DIV-5
    so both screens are decided together rather than twice.
  - **Test:** none — out of reach for this UC's scenarios, which all write against **Draft** schedules
    (the indicator only renders once a report has left Draft). S20 covers the non-Draft render but asserts
    only that the Add panel and row actions are absent and Check Status is disabled. `not-applicable
    (E2E, current scope)` in coverage.md; revisit with the submission/review UC (Epic 26).

---

## Coverage gap

> Things the use case asks for that this suite does **not** currently assert, each with the reason. None
> of these is a known fault; they are honest holes.

- **GAP-1 — The 3,500-character Comments limit is not tested.**
  - Comments entry and persistence *are* covered (`happy-path.feature` `@S01` types a comment and reads it
    back), but nothing tries to exceed the cap. The app enforces it two ways — Carbon's `maxCount` counter
    in the browser and `@Size(max=3500)` on the server (message: "Comments must be 3500 characters or
    fewer.") — so the message is only reachable by calling the API directly.
  - **Checked for existing unit coverage 2026-08-10: there is NONE.** Neither layer tests the cap —
    `Schedule11WriteIT` has no `@Size`/3500 case (its validation tests are blank-location, missing-enhanced,
    missing-selections, out-of-range, NAR-decimals, unresolvable-biogeo), and
    `components/schedule11/__tests__/validation.test.ts` covers only `parseDecimalInput`, the cost range and
    the NAR one-decimal rule. So this gap is real and currently uncovered at every level.
  - **Where it belongs — NOT here.** The browser cannot reach it: Carbon's `maxCount` stops the 3,501st
    character, so no UI test can produce the server message. The right home is a **backend bean-validation
    test** on `SilvicultureLocationRequest` (one `@Size(max=3500)` case, ~5 lines beside the existing
    `blankLocation_returns400`), which is Story 25.2 territory, not 25.4.
  - **Status:** OPEN — `deferred` in coverage.md; **ACTION: backend team to add the `@Size` case.** Low risk
    (two independent enforcement points, no data-loss path), so this is tidy-up, not a blocker.

- **GAP-2 — The 30-character Location limit is not tested.**
  - The Add field carries `maxLength={30}`, so a 31st character cannot be typed and the server message
    ("Location must be 30 characters or fewer.") is unreachable through the UI.
  - **Checked for existing unit coverage 2026-08-10: there is NONE** — same finding as GAP-1, same two test
    files searched. Uncovered at every level today.
  - **Where it belongs — NOT here**, for the same reason as GAP-1: a backend bean-validation case on
    `SilvicultureLocationRequest`'s `@Size(max=30)`. Pair it with GAP-1's in one small backend change.
  - **Status:** OPEN — `not-applicable (UI)` in coverage.md; **ACTION: backend team**, with GAP-1.

- **GAP-3 — CLOSED 2026-08-10: the per-row conflict is now covered end-to-end.**
  - **Test written:** `concurrency.feature` `@p1` — "Saving a row that another session already changed is
    rejected, and their value survives". Opens the row's editor (which captures its `revisionCount`),
    changes the row through the API so the stored token moves on, then saves from the browser: the PUT
    carries the stale token, the 409 detail renders verbatim, and **the other session's value is asserted
    as the survivor** so a lost-update bug cannot pass.
  - **Why it was worth writing even though an IT existed:** `Schedule11WriteIT.staleAndMissingRevision()`
    proves the *server* returns 409; it says nothing about what the *user* sees. If the app swallowed the
    409 a licensee would believe their correction saved when it had not. That is the risk this covers, and
    the IT could not.
  - **Proven non-vacuous:** with the concurrent-change step removed the scenario FAILS (no conflict
    message) — checked 2026-08-10, so the assertion genuinely depends on the staged conflict.
  - **No second browser context needed:** `startEdit` copies the token into React state, so one context
    plus one API call stages the conflict. (The earlier note claiming this needed two sessions overstated
    the cost.)
  - **Status:** CLOSED — `covered` in coverage.md. No legacy slice describes it; SPEC-1 stays open for that.
- **GAP-4 — CLOSED 2026-08-10 as not-applicable to E2E: duplicate-location and invalid-BEC-code
  rejections cannot be reached through the UI, and are IT-covered at the endpoint.**
  - **Not reachable here, by design:** forced selection (BR-09) means the browser can only ever submit a
    catalogue id it just received, so neither condition can be produced through the UI. Faking it would
    mean intercepting the request and injecting a bad payload — that would test the interceptor, not the
    app, so it is deliberately NOT done.
  - **Already covered where it belongs:** `Schedule11WriteIT.duplicateBiogeoLocation_returns409()` ("AC6:
    duplicate (year,mill,cat,biogeo,location) → 409 verbatim biogeo-unique") and
    `Schedule11WriteIT.unresolvableBiogeo_returns400()`. Endpoint-level is the right layer for both.
  - **Caveat, stated rather than implied:** those ITs **do not run in CI** —
    `backend/pom.xml` defaults `skip.integration.tests=true` and `analysis.yml` runs a plain `mvn verify`.
    So both rules are *verified once, ungated thereafter*. That is the pre-existing AR17 limitation; closing
    this gap does **not** mean the rules are protected against regression, only that E2E is the wrong place
    to protect them.
  - **Status:** CLOSED — `not-applicable (UI)` in coverage.md, cross-referenced to the two ITs and AR17.
    See SPEC-1 for the missing slices.
- **GAP-5 — CLOSED 2026-08-10: column sorting is already covered by unit tests, and they run in CI.**
  - **What we found:** `components/schedule11/__tests__/Schedule11.test.tsx` has a dedicated
    `describe('Schedule 11 column sorting (legacy p:column sortBy parity)')` block with **7 tests**,
    including *"every column carries a sort control except Comments and Actions (xhtml:353/364)"* — i.e. it
    pins the legacy `sortBy` parity directly.
  - **And unlike the ITs, these DO gate:** CI runs `npm run test:cov` (`analysis.yml`), so a sorting
    regression fails the build.
  - **So neither an E2E scenario nor a manual test is warranted.** E2E would be strictly worse here:
    slower, needs the full stack + seeded DB, and would assert the same pure-presentation logic the Vitest
    block already covers deterministically. Sorting persists nothing and issues no request, so there is no
    integration risk for E2E to find that the unit tests miss. Manual testing would be worse again —
    unrepeatable and ungated.
  - **Status:** CLOSED — covered by Vitest (in CI). `covered (unit)` in coverage.md. SPEC-2 (no slice
    describes sorting) stays open as a BA paperwork item, independent of test coverage.

- **GAP-6 — There is no role-dependent Schedule 11 behaviour to cover yet.** _(REWORDED 2026-08-10 — the
  earlier wording said the 403 paths were "blocked (env)" because security is off locally, which implied we
  were failing to cover behaviour that exists. Re-checked against the code: that behaviour does not exist.
  This is the same correction Schedule 1 made to its GAP-1 on 2026-08-07; the original wording here
  repeated the mistake.)_
  - **Why not:** `ILCR_ADMIN` and `ILCR_SUBMITTER` are granted **exactly the same actions**. From
    `security/SchedulePermissions.java`:
    `ROLE_ACTIONS.put(Role.ADMIN, EnumSet.of(VIEW_SCHEDULE, EDIT_SCHEDULE));`
    `ROLE_ACTIONS.put(Role.SUBMITTER, EnumSet.of(VIEW_SCHEDULE, EDIT_SCHEDULE));`
    — and every `Schedule11Controller` endpoint is guarded by `VIEW_SCHEDULE` (read + check-status) or
    `EDIT_SCHEDULE` (writes) only, with no admin-only branch anywhere. So **no role-driven 403 exists on
    this UC**. There is nothing to assert, not merely something we cannot reach.
  - **A 403 is still reachable in principle** — by a caller holding *neither* action (an unknown/foreign
    authority). That is an authorization-framework concern, not Schedule 11 behaviour, and it is covered by
    the backend's own tests rather than owed by this suite.
  - **On the header's mock-user selector:** it is a frontend-only display affordance and does not grant
    roles — the backend stamps one authority per process from `ilcr.security.mock-role`. Switching it
    changes the name on the Home card, not what you may do. (Detail in Schedule 1's GAP-1.)
  - **Future action:** revisit when FAM auth lands **and the two `ROLE_ACTIONS` sets actually diverge**. The
    lever would then be a CI matrix (a second run against `ilcr.security.mock-role=ILCR_ADMIN`), not a
    per-test switch, because the authority is fixed per process.
  - **Status:** OPEN (informational). Verified 2026-08-10.
  - **Test:** none needed today — `not-applicable (no role-dependent behaviour)` in coverage.md.

- **GAP-7 — Follow-up for the app team: two stale `PROVISIONAL` comments in `validation.ts`.**
  - `components/schedule11/validation.ts` marks two message strings "PROVISIONAL … the exact live-app text
    is confirmed in Story 25.4" (lines 20 and 24). Story 25.4 is this work, and **both are now confirmed
    correct** (VER-1 and VER-2). The comments are simply out of date and should be updated
    to say so.
  - **Why we did not just fix it:** this suite changes **no application source** — that is a hard rule.
    Raised here for the app team.
  - **Status:** OPEN — trivial comment-only follow-up in app source.

---

## Spec gap

> The requirements/Gherkin do not describe behaviour the app genuinely has. These feed back to the BA, not
> to the dev team.

- **SPEC-1 — The UC has no slices for the new app's write-conflict and duplicate-data rules.**
  - Schedule 11 now enforces three rules the legacy UC never described, because legacy had no equivalent:
    a per-row optimistic lock (stale edit → 409), a duplicate biogeo/location key rejection (409), and an
    unresolvable BEC-code rejection (400, with its own message in the bundle). Legacy's single page-level
    Save had no per-row concurrency concept at all.
  - **Why it matters:** these are user-visible error messages with no requirement behind them, so nothing
    says what the *intended* wording or recovery is — and no slice means no test is owed, which is how a
    real behaviour ends up permanently unverified.
  - **Suggested action (BA):** derive slices for these three, in the same way UC-SCH1-001-S25 was derived
    when the Schedule 1 inline edit turned out to be missing. Then GAP-3/GAP-4 become ordinary
    owed tests rather than judgement calls.
  - **Status:** OPEN — awaiting BA review.

- **SPEC-2 — Column sorting has no slice.**
  - The table sorts on eight columns with a three-state cycle, which is a deliberate improvement on
    legacy's two-state toggle (it adds a way back to the server's original order). No slice covers
    sorting in either form.
  - **Status:** OPEN — awaiting BA review. Low priority: presentational, persists nothing.

---

## Verified — not a defect

> Checked because something looked wrong or unknown, and confirmed correct. Recorded so nobody re-opens
> them. **All four resolve items the legacy requirements explicitly could not pin down.**

- **SPEC-3 — S03's Gherkin asserts a pre-save recompute that legacy never had.** _(NEW 2026-08-10)_
  - **What's wrong with the spec:** `UC-SCH11-001-S03.feature` asserts "the row's Total Act Plus Plan Cost
    and Total/NAR(ha) columns recompute immediately via AJAX" and "the footer Totals row recomputes to
    reflect the updated Actual Cost" — both **before** the Save click — and its trailing note attributes
    this to "the row-level `p:ajax` listener (BR-08, CNT-001)".
  - **Why that is not in the source:** the two derived cells are `disabled="true"` inputs, so their
    `p:ajax` can never fire; the editable fields' `p:ajax` updates only `@this`, the `*OV` indicator and
    the message panel (`schedule11.xhtml:283/303/319`); nothing references the total cells or a footer id.
    Derived values refreshed on the Save re-render (`update=":mainPnl @form"`). The sidecar's CNT-001 entry
    is accurate in itself ("recomputed on every render of `schedule11DTForm`") — the Gherkin turned
    "on every render" into "immediately as you type", which is the over-read.
  - **Why it matters:** it caused a false Divergence to be logged against the new app (disproved and
    reclassified to VER-6). Left uncorrected, the next person to re-ground this UC would log it again.
  - **Suggested action (BA):** correct S03's two Then steps to assert the refresh **after** Save, and drop
    the "recompute immediately via AJAX" note.
  - **Status:** OPEN — awaiting BA review. No app or test change needed; the tests already assert the
    correct (post-save) behaviour.

- **VER-1 — "Enhanced: Value is required." is correct, and better than legacy.**
  - **Why it looked wrong:** The legacy sidecar flagged this message `[UNKNOWN]` and predicted the app
    would show a raw internal field id — `"addLocationForm:addEnhancedIndicator: Value is required."` —
    because the legacy control had no label attached. The app's own `validation.ts` still calls its string
    "PROVISIONAL (S15): live-app text unconfirmed."
  - **What we found:** The new app defines the message properly:
    `enhancedIndicatorRequiredErrorMsg=Enhanced: Value is required.`
    (`backend/src/main/resources/messages.properties:88`). Confirmed live 2026-08-10 — a POST with
    `enhancedIndicator: null` returns exactly that text.
  - **Verdict:** Not a defect — a deliberate fix of a legacy defect (users no longer see an internal id).
    Legacy's behaviour was the bug. **Now asserted verbatim** by `validation.feature` `@S15`.
  - **Status:** CLOSED as verified 2026-08-10. Leaves the comment follow-up in GAP-7.

- **VER-2 — "Entered NAR (ha) must be between 0 and 999,999.9." is correct, and better than legacy.**
  - **Why it looked wrong:** The legacy sidecar left FLD-002 as `[TODO — capture from live app]` because
    legacy never overrode the framework's built-in range message, so its wording was whatever the Java
    framework emitted. `validation.ts` likewise calls its string "PROVISIONAL (S18)".
  - **What we found:** The new app defines it explicitly:
    `netAreaRangeErrorMsg=Entered NAR (ha) must be between 0 and 999,999.9.`
    (`messages.properties:91`), matching the house style of the cost message. Confirmed live for both
    out-of-range directions.
  - **Verdict:** Not a defect — a deliberate improvement. **Now asserted verbatim** by
    `validation.feature` `@S18` in both directions. **Status:** CLOSED as verified 2026-08-10.

- **VER-3 — The double space in "location  : …" is intentional and must not be "fixed".**
  - **Why it looked wrong:** The Check Status message reads
    `location  : E2E S05 noactual - Actual cost: Value Required` — with **two** spaces after "location".
    It reads like a typo and an eager cleanup would remove it.
  - **What we found:** It is a verbatim legacy literal, deliberately reproduced. The new backend composes
    it as `"location  : " + location + " - " + costLabel + ": " + …` in
    `Schedule11Service.missingCost()`, whose own comment flags the double space. Confirmed live.
  - **Verdict:** Not a defect — intentional legacy fidelity. The tests assert it **with** the double space
    on purpose (`check-status.feature` `@S05`/`@S06`), so any "tidy-up" will fail loudly. That is the point.
  - **Status:** CLOSED as verified 2026-08-10.

- **VER-4 — The delete confirmation wording is now known.**
  - **Why it was open:** S07/S08 marked the confirmation prompt `[UNKNOWN]` — the legacy text was never
    captured, and the Gherkin correctly refused to invent one.
  - **What we found:** The new app asks, in a Carbon modal titled **"Delete location"**: *"This will
    delete the current record. Do you want to continue?"* with **Delete** / **Cancel** buttons (not
    legacy's Yes/No). It is a normal in-page dialog, not a browser popup, so no special dialog handling is
    needed. The same wording is already used by Schedule 1's delete, so it is house style.
  - **Verdict:** Not a defect — the gap is closed. Now asserted by `delete.feature` `@S07`/`@S08`.
  - **Status:** CLOSED as verified 2026-08-10.

- **VER-5 — The legacy `ILCR_LICENSEE` role was re-grounded to the new two-group model.**
  _(previously logged here as a divergence; reclassified 2026-08-10 to match how Schedule 1 files the
  identical finding)_
  - **Why it looked wrong:** every UC-SCH11-001 scenario opens "Given I am authenticated as a Licensee
    (Mill Reporter, `ILCR_LICENSEE`)", and no such role exists in the new app.
  - **What we found:** the ratified model is `ILCR_ADMIN` + `ILCR_SUBMITTER` (**PRD DL-23**). Legacy really
    did have `ILCR_LICENSEE` — confirmed in the legacy source, `Constant.java:580`:
    `INVALID, ILCR_ADMIN, ILCR_AUDITOR, ILCR_LICENSEE` — so the Gherkin was accurate about legacy; the
    role was deliberately renamed as part of the rebuild, not dropped by accident. Schedule 11 writes are
    authorized for `ILCR_SUBMITTER`, which is the authority the scenarios run under (live: `POST
    /api/v1/schedule11/locations` → 200, `message.text = "Data saved successfully"`, persisted on
    read-back).
  - **Verdict:** Not a defect — a deliberate rename, ratified in the PRD. Nothing for BA/QA to adjudicate,
    which is why it no longer sits in the Divergence register with an `OPEN` status.
  - **Note the two separate facts** people conflate here: the *rename* is settled (this entry), while the
    absence of any **role-dependent behaviour** to test is a coverage disposition (**GAP-6**). Neither is a
    defect, but they answer different questions.
  - **Status:** CLOSED as verified 2026-08-10. Mirrors Schedule 1's equivalent Verified entry.

- **VER-6 — Derived totals refresh on save, not as you type — and legacy behaved the same way.**
  _(previously logged here as a divergence, wrongly; reclassified 2026-08-10)_
  - **Why it looked wrong:** the S03 Gherkin asserts "the row's Total Act Plus Plan Cost and Total/NAR(ha)
    columns recompute immediately via AJAX" and "the footer Totals row recomputes" — both **before** the
    Save click — and attributes it to "the row-level `p:ajax` listener (BR-08, CNT-001)". The new app
    plainly does not do that: it renders those cells read-only from server-computed values (AD-5) and
    refreshes them from the save response. Taken at face value, that reads as a lost legacy capability.
  - **What we found — legacy never did it either.** Read from `schedule11.xhtml` directly rather than the
    derived sidecar:
    - the two derived cells are `p:inputText … disabled="true"` (lines 334–352), so their
      `p:ajax event="change"` **can never fire** — a disabled input emits no change event;
    - the editable fields' handlers update only themselves, their original-value indicator and the message
      panel — e.g. line 303 `update="@this actualCostOV :schedule11MessageForm:messages"`. **No row-field
      `p:ajax` references either total cell or any footer id.**
    - derived values refreshed when the form re-rendered, i.e. on Save: `btnSaveTop` carries
      `update=":mainPnl @form"` (line 188).
  - **Verdict:** Not a defect, and not a divergence. Both apps refresh derived figures on save; the new app
    reaches the same user-visible behaviour by a different mechanism (server-derived, AD-5). The Gherkin
    over-read its own source — the sidecar's CNT-001 entry is accurate ("recomputed on every render of
    `schedule11DTForm`"); the Gherkin turned "on every render" into "immediately as you type".
  - **The spec still needs fixing** so this is not re-discovered as a false divergence next time someone
    re-grounds this UC — tracked as **SPEC-3**.
  - **Status:** CLOSED as verified 2026-08-10. The test never changed: `inline-edit.feature` `@S03` always
    asserted the post-save refresh, which is what both apps do. Nothing was weakened to reach this verdict.
