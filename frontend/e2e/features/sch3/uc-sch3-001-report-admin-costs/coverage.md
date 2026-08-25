# Coverage — UC-SCH3-001 Report Forest Management Administration Costs (Schedule 3)

> New to these files? See [`coverage-guide.md`](../../../coverage-guide.md) at the e2e root for the column + status-flag legend.

Sources reconciled: `UC-SCH3-001-S01..S24.feature` (24 slices, 34 scenarios) + `UC-SCH3-001-slices.md`
(the 62-field / 11-rule / 5-precondition / 4-combination Gap Analysis Summary and its 12 deliberate
exclusions) + `UC-SCH3-001-detailed.md` + `UC-SCH3-001-technical.md` (message catalog ERR-001..004,
ALT-001..003, WRN-001/002, STA-001/002, CNT-001, FLD-001..003, SUC-001..003, ASY-001), against the app's
real write path (`schedule3/api/Schedule3Api.java` GET/PUT/DELETE + `check-status`, the two sub-resource
APIs, `Schedule3Controller`, `Schedule3Service`, `Schedule3Constants`, `dto/Schedule3Request`, and
`components/schedule3/{index.tsx,derived.ts,validation.ts}` +
`components/schedule3SubPage/index.tsx` + `hooks/useEditableCostRows.ts`).

> **Where the source documents live.** They are in the **`ilcr-bmad`** planning repo, not this one, so no
> relative link from here can resolve (this suite is deliberately self-contained so it can be lifted into
> the app repo). Repo-root-relative paths in `ilcr-bmad`:
> `_bmad-output/implementation-artifacts/tests/UC-SCH3-001/gherkin/` (the 24 `.feature` slices) and
> `_bmad-output/planning-artifacts/requirements/use-cases/UC-SCH3-001/` (the detailed UC, slice catalog
> and technical sidecar).

Test data (real, discovered 2026-08-24): pinned in `fixtures/sch3/schedule3-test-data.ts` with the
finding queries in comments. Anchors were found by enumerating `GET /v1/mills` and probing
`GET /v1/schedule3` over every mill × reporting year 2010–2026 (357 probes), then classifying by HTTP
status / `trackStatus` / `editable` / stored values. Every **mutating** scenario owns a distinct
(mill, year); the read-only anchors are shared. `preflight/sch3-anchors.setup.ts` (7 checks) asserts
every anchor, its at-rest contents, the two BR-09 Schedule 1 states, the seeded amounts and both guard
responses before a browser opens.

**Why this domain needs a seed patch — read this first.** Schedule 3 has **no create path**: every
operation resolves the category-3 summary and 404s when it is absent, where legacy created that row on
the first Save. The extract marks Schedule 3 *required* on 118 mill-years and *started* on only 31, so 87
Draft mill-years cannot be entered at all — that is **defects.md DIV-1**, tracked by a deliberately-RED
scenario. It also means a Schedule 3 anchor cannot be created through the API, so
`real-test-data-patches/sch3/draft-anchors.sql` seeds the one row legacy's first Save would have written
on 16 mill-years (and, on four of them, stored amounts the read-only Check Status scenarios need). **If
DIV-1 is fixed, most of that patch can be retired.**

**Cross-schedule note (why the anchor choice matters here more than elsewhere):** Schedule 1 pulls its
item-143 / item-139 costs **from** Schedule 3, Schedule 2 carries its purchased-log volume and wood
overhead **from** Schedule 3, and the BR-09 Crown Timber push **writes Schedule 1's own volume rows**. A
sch1 or sch2 scenario on the same (mill, year) would therefore watch its anchor move mid-test — a real
data race, not ordinary hygiene. No anchor here is pinned by sch1, sch2 or sec (checked pair-by-pair).
Fifteen are also pinned by **sch4**/**sch11**, which is safe *structurally*: no backend path links
Schedule 3 to Schedule 4 or 11, and those suites write category-"4"/"11" rows this one never reads. Every
one of those shares is declared with its reason in `preflight/sch4-anchors.setup.ts`.

Scope: S01/S03 enter+save+reopen with the full derived arithmetic (`happy-path.feature`); S02 the Annual
Rents S111 alert (`alerts.feature`); S04/S05 the two cost sub-pages (`other-costs.feature`,
`unacceptable-costs.feature`); S06/S07 the BR-09 crown push, both outcomes, read back on Schedule 1
(`crown-push.feature`); S08 delete + cancel (`delete.feature`); S09–S12 Check Status through all four
outcomes plus the S12 mirror (`check-status.feature`); S13–S16 the guards and the read-only render
(`render-states.feature`); S17 a persistence failure and its retry (`save-error.feature`); S20–S24 entry
rejection on the main page and both sub-pages (`validation.feature`); WCAG 2.1 AA across four
structurally distinct renders (`accessibility.feature`); and the DIV-1 divergence (`no-create.feature`).

**22 of the 24 slices are dispositioned `covered`; S18 and S19 are `not-applicable`** (the state they
describe cannot exist in the rewrite — DIV-3). **34 scenarios / 43 tests after Scenario-Outline
expansion: 40 green + 3 deliberate `@discovered-divergence` REDs** (DIV-1, DIV-5 and DIV-6). A clean run is
`npm run test:gate` (regenerates the features first and excludes every `@discovered-*` red); verified
green twice consecutively, and the suite ran identically across two back-to-back full runs.

Priorities: **5 × p0, 27 × p1, 11 × p2.**

## Story AC traceability — bcgov/nr-ilcr#83 (Story 28.3, epic #226)

The issue's acceptance criteria name the journeys explicitly. Each clause is mapped here so the AC can be
checked without reading the matrix below.

| #83 requires | Scenario | Status |
|---|---|---|
| "enter, save, and reopen the fixed admin-cost lines and timber volumes, including the Annual Rents alert (S01–S03)" | `happy-path.feature` `@p0 @S01 @S03` (all 11 lines, both volumes, Override, comments, full derived arithmetic in UI **and** stored, then a reload); `alerts.feature` `@p1 @S02` | `covered` |
| "itemize other-acceptable and included-unacceptable cost rows with the Schedule 3 counts updating on return (S04, S05)" | `other-costs.feature` `@p1 @S04` (add → count 1 → in-place edit → remove → count 0); `unacceptable-costs.feature` `@p1 @S05` (count 1 → 2, Totals, Annual Rents S111 figure) | `covered` |
| "change the Crown Timber volume and see the propagation visible on Schedule 1 in both the applied (WRN-001) and Schedule-1-not-yet-opened (WRN-002) outcomes (S06, S07)" | `crown-push.feature` `@p0 @S06` (all 13 pushed items read back on Schedule 1) and `@p1 @S07` (Schedule 1 asserted still absent) | `covered` |
| "delete the whole schedule (S08)" | `delete.feature` `@p1 @S08` + `@p2 @S08` cancel (proves the no-op with the mutation spy) | `covered` |
| "run Check Status through its all-met, missing-required, Harvest<PO&P, and Override-suppression outcomes (S09–S12)" | `check-status.feature` — 6 scenarios: `@p0 @S09`, `@p0 @S10` (whole field inventory), `@p1 @S10` (sub-page fields), `@p1 @S11`, `@p1 @S12` and its mirror | `covered` — but see **DIV-6**: every one of these checks AFTER a save, which is why the suite did not catch that Check Status ignores unsaved edits |
| "render each context guard and the read-only non-Draft state (S13–S16)" | `render-states.feature` — `@p1 @S13`, `@p1 @S14`, `@p2 @S16`, `@p1 @S15` outline (**both** Submitted and Verified) + `@p2 @S15` read-only sub-page | `covered` |
| "retry a failed save (S17)" | `save-error.feature` `@p1 @S17` — both arms, with the record read back to prove nothing was written | `covered` |
| "hit the save-before-sub-page gates (S18, S19)" | — | **`not-applicable`** — the gate cannot exist in the rewrite; see **DIV-3** (closed), and DIV-1 for why |
| "reject out-of-range costs/volumes and blank descriptions on the main page and both sub-pages (S20–S24)" | `validation.feature` — 7 scenarios / 15 tests, every rejection proving zero writes **and** an unchanged record | `covered` |
| "axe accessibility checks … against the Schedule 3 page and both sub-pages … WCAG violations are zero or triaged" | `accessibility.feature` — 4 renders (editable, both populated sub-pages, read-only) | `covered` — **zero violations, nothing to triage** |
| "written after implementation — verification, not the red phase" | Stories 4.1/4.2/4.4 were `done` before this suite was authored | satisfied |

> **The one clause this suite cannot satisfy as written** is the S18/S19 gate. It is not an oversight and
> not a shortcut: the warning existed to stop a reporter opening a sub-page *before the schedule had ever
> been saved*, and in the rewrite a Schedule 3 that can be opened at all already exists. Reproducing the
> gate would mean reproducing a state the app cannot reach. DIV-3 records the replacement behaviour, which IS present and asserted verbatim (a
> discard-unsaved-edits modal, asserted verbatim on every sub-page entry) and DIV-1 records the reason.

## Re-grounding headline

Schedule 3 was rebuilt on React/Carbon, not ported from JSF/PrimeFaces, so several structural facts of
the legacy `.feature` set have no literal counterpart. Each is asserted as the app actually behaves and
recorded rather than silently dropped:

1. **Every legacy locator is gone.** `schedule3.xhtml` → route `/schedule-3`; the `schedule3Form:*`
   NamingContainer ids → stable Carbon ids derived from the cost-item code (`#harvest-27`, `#pop-27`,
   `#popTimberVolume`, `#crownTimberVolume`, `#overrideHarvestTotalPop`, `#comments`). **All 25
   `[UNKNOWN]` markers the legacy Gherkin carried forward are resolved** by the rewrite — the comments
   textarea, both Save buttons, Check Status, Delete, both Add buttons, and the FLD-003 message text are
   every one addressable or confirmed, so no scenario needs a JSF action-binding workaround.
2. **The derived columns move as you type, then are replaced by the server's figures on Save.** Legacy
   recomputed on each field's own `f:ajax`; the rewrite renders a display-only mirror (defect #291) and
   the Save response supersedes it. Pinned on both sides of the save — see `defects.md`
   "Verified — not a defect".
3. **No `p:messages` panel.** Results render as Carbon `InlineNotification`s whose severity is carried by
   an explicit title word, never colour alone (WCAG 2.1 AA); field errors render as inline `invalidText`.
   **The message text is unchanged**, so every legacy contract string is still pinned verbatim.
4. **Both confirmations are Carbon `Modal`s**, not PrimeFaces `confirmDialog`s and not native browser
   dialogs — "Delete schedule" for AF4 and "Leave Schedule 3" / "Leave page" for navigation. The legacy
   `confirmDeleteMsg` and `confirmNavigationMsg` texts are asserted verbatim.
5. **The one surviving browser dialog is ALT-001**, the Annual Rents S111 alert — still a real
   `window.alert`, now fired on blur rather than `onchange`, and captured with a dialog listener
   registered before the blur.
6. **Validation is client-advisory + server-authoritative.** Legacy rejected on the field's own AJAX
   round-trip; the rewrite validates on every keystroke and additionally *blocks* Save with an advisory
   banner. Both the legacy FLD-001/FLD-002 wording and the new gate wording are asserted.
7. **The Draft gate is a server-derived flag, not a per-control binding.** `Schedule3Response.editable`
   drives everything; a read-only schedule renders every figure as **text** (zero inputs) rather than as
   disabled inputs, so S15 is proved by counting what is rendered.

## Re-grounding gains (covered here, absent from the legacy slice catalogue)

| Gain | Why the legacy catalogue lacked it | Scenario |
|---|---|---|
| **FLD-003's message text is now known** | The sidecar could not confirm the JSF required-field wording and carried `[UNKNOWN]` / `[TODO — capture from live app]`. The rewrite has one: `Description: Value is required.` | `validation.feature` `@p1 @S23`, `@p1 @S24` |
| **Non-numeric entry is refused, with its own wording** | The catalogue excluded non-numeric entry: "no confirmed message text exists … inventing one would violate the evidence constraint." The rewrite has two distinct messages. | `validation.feature` `@p1 @S20` / `@p1 @S22` (last Examples row of each) |
| **Exact boundary values are observable** | Excluded as "not a separately observable code path". In the rewrite the client validator makes the inclusive bound directly assertable — 99,999,999 and 9,999,999 are accepted, one more is not. | `validation.feature` `@p2 @S20`, `@p2 @S22` |
| **The save round-trip survives a reload** | No legacy slice proves persistence independently of the client's own post-save repaint — after Save the page re-seeds its form from the response, which looks identical whether or not anything reached the database. | `happy-path.feature` `@p0 @S01 @S03` |
| **Both action bars work** | Legacy noted Save "appears twice, top and bottom" only as a *locator* problem; neither bar was ever asserted to function. | `happy-path.feature` (bottom-bar re-save) |
| **The full derived arithmetic is pinned** | The legacy slice asserted only that amounts "are stored as cost-report detail records". Every Crown, both subtotals, Total Costs, both timber costs and all three $/m³ figures are now computed by hand in the fixture and asserted in the UI **and** through the API. | `happy-path.feature` `@p0 @S01` |
| **The BR-09 push is verified on the far side** | S06/S07 asserted only the two messages. Schedule 1 is now read back and all 13 pushed volume items checked by name (or asserted still absent). | `crown-push.feature` both scenarios |
| **Every rejection proves the negative** | No legacy slice could distinguish "refused" from "refused in the UI but sent anyway". Each rejection asserts the mutation spy saw zero writes over a settled window **and** that the stored record is unchanged. | all of `validation.feature`, `delete.feature` `@p2` |
| **The sub-page BR-11 checks are exercised** | The legacy S10 pinned two representative fields. The sub-page half (missing description / PO&P / Total on itemized rows) is now covered from seeded data — it cannot be produced through the UI at all. | `check-status.feature` `@p1 @S10` |
| **WCAG 2.1 AA** | No legacy equivalent (NFR1 is a rewrite requirement). | `accessibility.feature` × 4 |

## Slice matrix

| Source item | Source citation | App enforcement / render point | Scenario (tags) | Status | Gap/defect |
|---|---|---|---|---|---|
| Enter the 11 fixed lines + both volumes + Override + comments, save, figures recomputed | `S01` | `Schedule3Service.saveSchedule3` / `index.tsx:169` | `happy-path.feature` `@p0 @S01` | `covered` | — |
| Annual Rents entry raises the S111 alert; its Crown recalculates | `S02`, ALT-001, BR-04 | `index.tsx:367` `window.alert` on blur | `alerts.feature` `@p1 @S02` | `covered` | — |
| Reopening pre-fills the saved amounts | `S03` | `seedForm` / `useScheduleDocument` | `happy-path.feature` `@p0 @S03` (after a full reload) | `covered` | — |
| Itemize grouped other-acceptable costs; count + subtotal follow on return | `S04`, BR-06, CNT-001 | `Schedule3Service.addOtherAcceptable` / `saveOtherAcceptable` | `other-costs.feature` `@p1 @S04` | `covered` | — |
| …and an in-place row edit persisted by the sub-page Save | `S04` (grid inputs) | `useEditableCostRows.persist` | `other-costs.feature` `@p1 @S04` | `covered` | — |
| …and a row removed again | `S04` (row Delete) | `removeRow` → batch PUT `intent=delete` | `other-costs.feature` `@p1 @S04` | `covered` | — |
| …and the removal asks for confirmation FIRST | `S04` (legacy `p:confirm` on the row Delete) | **not implemented** — `removeRow` persists at once | `row-delete-confirm.feature` `@discovered-divergence @p1 @S04` | `divergence` | **DIV-5** |
| Itemize included-unacceptable costs; count + total follow | `S05`, BR-07 | `Schedule3Service.addUnacceptable` | `unacceptable-costs.feature` `@p1 @S05` | `covered` | — (DIV-4 retracted: legacy counts it the same way) |
| The read-only Annual Rents (Forest Act, S111) figure on the sub-page | `S05`, BR-04 | `#annualRentsS111`, `buildUnacceptableDocument` | `unacceptable-costs.feature` `@p1 @S05` | `covered` | — |
| Crown Timber volume change pushed to an open Schedule 1 | `S06`, WRN-001, BR-09 | `Schedule1Service.applyCrownTimberVolume` | `crown-push.feature` `@p0 @S06` | `covered` | — |
| …and the not-applied outcome when Schedule 1 was never opened | `S07`, WRN-002 | same, `return false` | `crown-push.feature` `@p1 @S07` | `covered` | — |
| Delete the whole Schedule 3 | `S08`, SUC-002 | `Schedule3Service.deleteSchedule3` | `delete.feature` `@p1 @S08` | `covered` | — |
| Cancelling the delete confirmation is a no-op | `S08` (dialog dismiss) | Carbon `Modal` secondary action | `delete.feature` `@p2 @S08` | `covered` | — |
| Check Status — all requirements met | `S09`, SUC-003, BR-11 | `Schedule3Service.checkSchedule3Status` | `check-status.feature` `@p0 @S09` | `covered` | — |
| Check Status — every mandatory main-page field flagged | `S10`, BR-11 | `appendFixedLineCheckErrors` + the 2 volume checks | `check-status.feature` `@p0 @S10` (whole inventory) | `covered` | — |
| Check Status — missing description / PO&P / Total on itemized rows | `S10`, BR-11 | `appendOtherAcceptableCheckErrors`, `appendUnacceptableCheckErrors` | `check-status.feature` `@p1 @S10` | `covered` | — |
| Check Status — a fixed line's Harvest below its PO&P | `S11`, BR-03 | `appendFixedLineCheckErrors` | `check-status.feature` `@p1 @S11` | `covered` | — |
| Check Status — an other-acceptable row's Total below its PO&P | `S12` (mirror), BR-03 | `evaluateOtherAcceptableGroups` | `check-status.feature` `@p1 @S12` | `covered` | — |
| Check Status describes the SCREEN, including unsaved edits | `S12` / AF5 (legacy `ajax="false"` postback) | **not implemented** — the endpoint takes no body, so it evaluates stored data | `check-status-unsaved.feature` `@discovered-divergence @p1 @S12` | `divergence` | **DIV-6** |
| Override "Y" suppresses the Harvest≥PO&P check on other-acceptable rows | `S12`, BR-10 | `if (!override …)` | `check-status.feature` `@p1 @S12` | `covered` | **SPEC-1** (it suppresses the fixed lines too — as legacy did; the sidecar omits that) |
| Mill and reporting year not selected → form suppressed | `S13`, ERR-002 | `index.tsx:275` `contextMissing` | `render-states.feature` `@p1 @S13` | `covered` | — |
| Mill not active for the reporting year | `S14`, ERR-003 | `MillContextService.validateMillYearActive` → 409 | `render-states.feature` `@p1 @S14` | `covered` | — |
| Schedule not editable outside Draft (Submitted **and** Verified) | `S15`, STA-001, BR-01 | `Schedule3Response.editable` (server-derived) | `render-states.feature` `@p1 @S15` outline ×2 | `covered` | — |
| …and the cost sub-pages are read-only too | `S15` (sub-page bindings) | `EditableSubPageLayout` `editable` | `render-states.feature` `@p2 @S15` | `covered` | **DIV-3** (links still render — closed) |
| …and the read-only case for the *role* half of BR-01 | `S15`, BR-01 | `callerMayEdit` (EDIT_SCHEDULE) | — | `blocked` | **GAP-1** |
| Schedule not found → form suppressed | `S16`, ERR-004 | `MillContextService` guard 1 → 404 | `render-states.feature` `@p2 @S16` | `covered` | — |
| …and the rewrite's SECOND, much broader path to the same message | *(no legacy slice — the app 404s wherever a summary was never created)* | `Schedule3Service.java:170` | `no-create.feature` `@discovered-divergence @p0 @S16` | `divergence` | **DIV-1** |
| Save fails — persistence error, values kept, nothing written | `S17`, ERR-001 | `ScheduleNotSavedException` / `index.tsx:184` | `save-error.feature` `@p1 @S17` | `covered` | — |
| …and the retry after the failure clears succeeds | `S17` step 2 | same — the retry is not intercepted | `save-error.feature` `@p1 @S17` | `covered` | — |
| "Subtotal Other Costs" sub-page refused before the first save | `S18`, ALT-002, BR-08 | **no new-app equivalent** — the state cannot exist | — | `not-applicable` | **DIV-3** |
| "Included Unacceptable Costs" sub-page refused before the first save | `S19`, ALT-003, BR-08 | **no new-app equivalent** | — | `not-applicable` | **DIV-3** |
| Cost amount out of range — main page | `S20`, FLD-001 | `validation.ts` `COST` | `validation.feature` `@p1 @S20` outline ×4 | `covered` | — |
| …and an in-range value accepted afterwards, Crown recalculated | `S20` recovery | same | `validation.feature` `@p2 @S20` | `covered` | — |
| Cost amount out of range — both sub-pages | `S21`, FLD-001 | `schedule3OtherAcceptableCosts/validation.ts`, `schedule3UnacceptableCosts/validation.ts` | `validation.feature` `@p2 @S21` outline ×2 | `covered` | — |
| Volume out of range — main page (non-negative) | `S22`, FLD-002 | `validation.ts` `VOLUME` | `validation.feature` `@p1 @S22` outline ×5 | `covered` | — |
| …and an in-range volume accepted afterwards | `S22` recovery | same | `validation.feature` `@p2 @S22` | `covered` | — |
| Required description blank — Other Acceptable sub-page | `S23`, FLD-003 | `validateOtherAcceptable` | `validation.feature` `@p1 @S23` | `covered` | — |
| Required description blank — Included Unacceptable sub-page | `S24`, FLD-003 | `validateUnacceptable` | `validation.feature` `@p1 @S24` | `covered` | — |
| WCAG 2.1 AA across the distinct renders | NFR1 / #83 AC2 | — | `accessibility.feature` ×4 | `covered` | — |
| Two people saving the same schedule (stale lock token → 409) | *(rewrite-only, AR11 — no legacy slice)* | `Schedule3Repository.bumpRevision` | — | `deferred` | **GAP-2** |
| The Back-with-unsaved-edits prompt on a sub-page | `S04`/`S05` (navigate-away dialog) | `useEditableCostRows.handleBack` | — (the inbound prompt IS asserted) | `deferred` | **GAP-3** |

## Message catalog

| ID | Text | Where it now comes from | Scenario | Status |
|---|---|---|---|---|
| SUC-001 | `Data saved successfully` | API `message.text` (AD-8), key `dataSavedSuccesfullyInfoMsg` | `happy-path`, `crown-push`, `other-costs`, `unacceptable-costs`, `save-error` | `covered` |
| SUC-002 | `Data deleted successfully` | API, key `dataDeletedSuccesfullyInfoMsg` | `delete.feature` `@p1 @S08`; also the sub-page row removal | `covered` |
| SUC-003 | `All requirements for this schedule have been met` | API, key `scheduleRequirementsMetMsg` | `check-status.feature` `@p0 @S09`, `@p1 @S12` | `covered` |
| ERR-001 | `Schedule could not be saved.` | API `ProblemDetail.detail` (500); also the page's fallback | `save-error.feature` `@p1 @S17` | `covered` |
| ERR-002 | `Please Select Mill and Reporting Year in the Home Page.` | client-side (no request), `index.tsx:43` | `render-states.feature` `@p1 @S13` | `covered` |
| ERR-003 | `This Mill is not active for the current Reporting Year. Please select another mill from the Home Page.` | API `ProblemDetail.detail` (409) | `render-states.feature` `@p1 @S14` | `covered` |
| ERR-004 | `Schedule not found.` | API `ProblemDetail.detail` (404) | `render-states.feature` `@p2 @S16`; `no-create.feature` | `covered` |
| ALT-001 | `Annual Rent (Forest Act, S111) is recorded as an Unacceptable Cost.` | `window.alert` on blur, `index.tsx:44` | `alerts.feature` `@p1 @S02` | `covered` |
| ALT-002 | `The schedule has to be saved before opening other costs` | **no new-app equivalent** | — | `not-applicable` — **DIV-3** |
| ALT-003 | `The schedule has to be saved before opening Unacceptable costs` | **no new-app equivalent** | — | `not-applicable` — **DIV-3** |
| WRN-001 | `The new Crown Timber volume has been applied to Schedule 1 volume fields. Please check.` | API `warnings[]` on the save echo | `crown-push.feature` `@p0 @S06` | `covered` |
| WRN-002 | `The new Crown Timber volume couldn't been applied to Schedule 1 volume fields as it has not been opened.` (ungrammatical in the source bundle; asserted verbatim) | same | `crown-push.feature` `@p1 @S07` | `covered` |
| STA-001 | read-only state (every figure as text, all three actions disabled) | `Schedule3Response.editable` | `render-states.feature` `@p1 @S15` outline, `@p2 @S15` | `covered` |
| STA-002 | "the schedule has never been saved" (drives ALT-002/003) | **no new-app equivalent** — see DIV-1 | — | `not-applicable` — **DIV-3** |
| CNT-001 | `Subtotal Other Costs (n):` / `Included Unacceptable Costs (n):` | ghost-button labels, server counts | `other-costs.feature`, `unacceptable-costs.feature` | `covered` | 
| FLD-001 | `Entered cost must be between -99,999,999 and 99,999,999.` | `validation.ts` (mirrors the backend bundle) | `validation.feature` `@p1 @S20`, `@p2 @S21` | `covered` |
| FLD-002 | `Entered volume must be between 0 and 9,999,999.` | same (Schedule 3 volumes are non-negative) | `validation.feature` `@p1 @S22` | `covered` |
| FLD-003 | `Description: Value is required.` | `validateOtherAcceptable` / `validateUnacceptable` — **the rewrite RESOLVED the legacy `[UNKNOWN]`** | `validation.feature` `@p1 @S23`, `@p1 @S24` | `covered` *(gain)* |
| ASY-001 | *(not triggered — Schedule 3 is synchronous)* | — | — | `not-applicable` — unchanged in the rewrite |
| *(check labels)* | `<field>: Value Required` × 21 main-page fields + 3 sub-page fields | `Schedule3Service` prefixes the verbatim legacy label | `check-status.feature` `@p0 @S10`, `@p1 @S10` | `covered` |
| *(check labels)* | `<field>: Value must be greater than or equal to the corresponding PO&P Cost` | same | `check-status.feature` `@p1 @S11`, `@p1 @S12` | `covered` |
| *(new)* | `Please correct the highlighted fields before saving.` | client gate, `index.tsx:179` | `validation.feature` `@p1 @S20`, `@p1 @S22` | `covered` |
| *(new)* | `Entered cost is invalid.` / `Entered volume entry is invalid.` | `validation.ts` NaN guards | `validation.feature` `@p1 @S20`, `@p1 @S22` (last Examples row) | `covered` *(gain)* |
| *(legacy chrome)* | `This will delete the current record. Do you want to continue?` (`confirmDeleteMsg`) | Carbon `Modal` body | `delete.feature` `@p2 @S08` | `covered` |
| *(legacy chrome)* | `Any unsaved data will be lost. Are you sure you would like to continue?` (`confirmNavigationMsg`) | Carbon `Modal` body | asserted on **every** sub-page entry (`schedule3Page.openSubPage`) | `covered` |
| *(new)* | `Description must be 30 characters or fewer.` | `validateOtherAcceptable` / `validateUnacceptable` | — | `not-applicable` — the input carries `maxLength={30}`, so the browser caps entry and the branch is unreachable through the UI (the same reason the legacy catalogue excluded the comments 3,500-char limit) |
| *(new)* | `Unable to load Schedule 3.` / `Unable to delete Schedule 3.` / the sub-page load/save fallbacks | page fallbacks when the API returns no detail | — | `deferred` — belongs in Vitest, not E2E (an API that always sends a detail cannot exercise them) |

## Controls (40 in the slice catalogue's Field Reference)

| Control group | Legacy id | New app | Scenario | Status |
|---|---|---|---|---|
| The 8 both-column lines — Harvest + PO&P (27/28/30/31/32/34/35/36) | `schedule3Form:{item}Harvest` / `...POP` | `#harvest-<code>` / `#pop-<code>` | `happy-path`, `validation`, `check-status` | `covered` |
| Annual Rents (29) + Silviculture Admin (37) — Harvest only, PO&P **not captured** | `...annualRentsPOP` (hidden `h:inputHidden`) | no input at all; the cell renders an em dash | `happy-path` (blank cell **and** absent input asserted) | `covered` |
| Scaling Expense (33) — Harvest entered, PO&P **derived** read-only | `...scalingExpensePOP` (`disabled="true"`) | read-only text, server-derived from the volume ratio | `happy-path` (3,750 asserted) | `covered` |
| Crown column ×11 (computed) | `...{item}Crown` (`disabled`) | read-only text | `happy-path`, `alerts`, `validation` `@p2 @S20` | `covered` |
| Subtotal Other Costs / Subtotal (Actual Costs) / Included Unacceptable / Total Costs — 12 cells | `schedule3Form:subtotal*`, `totalCosts*` | read-only text rows | `happy-path`, `other-costs`, `unacceptable-costs` | `covered` |
| Override Harvest ⁄ Total PO&P | `...overrideTotPopVal` | `#overrideHarvestTotalPop` (Carbon `Select`, N/Y) | `happy-path`, `check-status` `@p1 @S12` | `covered` |
| PO&P Timber / Crown Timber volumes | `...popTimberVolume`, `...crownTimberVolume` | `#popTimberVolume`, `#crownTimberVolume` | `happy-path`, `crown-push`, `validation` | `covered` |
| Both timber Total Cost / Cost-per-Unit + Total Overhead (9 cells) | `...popTimberCost` etc. (`disabled`) | read-only text | `happy-path` (all three $/m³ asserted) | `covered` |
| Additional comments | `[UNKNOWN]` | `#comments` | `happy-path` (typed, stored, re-read after reload) | `covered` |
| Save ×2 / Check Status / Delete | `[UNKNOWN]` ×4 | Carbon `Button`s (`ScheduleActions`) | `happy-path` (both bars), `check-status`, `delete`, `render-states` | `covered` |
| The two sub-page count links | `...subtotalOtherCostsEditsEnabled` + 2 render variants each | one ghost `Button` each, always rendered | `other-costs`, `unacceptable-costs`, `render-states` | `covered` | 
| Other-acceptable Add panel: Description / Harvest Total / PO&P | `addCostForm:description` / `:total` / `:pop` | `#add-description` / `#add-total` / `#add-pop` | `other-costs`, `validation` `@p1 @S23`, `@p2 @S21` | `covered` |
| Other-acceptable row grid: Total / PO&P / Crown (derived) | `otherCostsDT:{row}:otherCostTable` etc. | `#row-total-<key>` / `#row-pop-<key>` + derived text | `other-costs` (in-place edit + Crown) | `covered` |
| Included-unacceptable Add panel: Description / Total | `addCostForm:description` / `:cost` | `#add-description` / `#add-total` | `unacceptable-costs`, `validation` `@p1 @S24` | `covered` |
| Annual Rents (Forest Act S111) read-only total | `[UNKNOWN]` | `#annualRentsS111` (disabled) | `unacceptable-costs` `@p1 @S05` | `covered` |
| Comments 3,500-character limit | `maxlength="3500"` | Carbon `maxCount` + `enableCounter` | — | `not-applicable` — the counter caps input in the browser; no server rejection path exists to assert (the legacy catalogue excluded it for the same reason) |

## Business rules

| Rule | Scenario | Status |
|---|---|---|
| BR-01 editable only in Draft (+ Licensee role) | `render-states.feature` `@p1 @S15` outline (both non-Draft codes) | `covered` (track half) / `blocked` (role half — **GAP-1**) |
| BR-02 each line persisted as a cost-report detail record | `happy-path` — API read-back of all 11 lines + both volumes + comments + Override | `covered` |
| BR-03 Harvest ≥ PO&P, flagged by Check Status | `check-status.feature` `@p1 @S11` (fixed line) + `@p1 @S12` (other-acceptable row) | `covered` |
| BR-04 Annual Rents + Silviculture Admin are Harvest-only; Annual Rent is an unacceptable cost | `happy-path` (blank cells, no inputs, stored PO&P 0), `alerts` (S111 alert), `unacceptable-costs` (the S111 figure + the count) | `covered` |
| BR-05 Crown / subtotals / totals / overhead are computed read-only | `happy-path` — the full arithmetic, UI **and** stored | `covered` |
| BR-06 grouped other-acceptable rows (Description, Total, PO&P, derived Crown) | `other-costs.feature` `@p1 @S04` | `covered` |
| BR-07 included-unacceptable rows (Description + Total only) | `unacceptable-costs.feature` `@p1 @S05` | `covered` |
| BR-08 a sub-page cannot be opened until the schedule is saved | — | `not-applicable` — **DIV-3** (closed); the navigate-away confirm that legacy paired with it IS preserved and asserted |
| BR-09 a changed Crown Timber volume propagates into Schedule 1 | `crown-push.feature` both scenarios, read back on Schedule 1 | `covered` |
| BR-10 Override "Y" suppresses the Harvest≥PO&P check | `check-status.feature` `@p1 @S12` + its mirror | `covered` — wider than the sidecar describes, and legacy-faithful (**SPEC-1**; raised as DIV-2, retracted) |
| BR-11 Check Status requires the amounts, both volumes and each row's description + cost | `check-status.feature` `@p0 @S10` (main page, whole inventory) + `@p1 @S10` (sub-page rows) | `covered` |

## Deliberately excluded by the slice catalogue — re-checked against the new app

The catalogue lists 12 deliberate exclusions. Each was re-tested against the rewrite rather than
inherited:

| Excluded item | Legacy reason | Verdict against the new app |
|---|---|---|
| Precondition 1 (authorized for the Schedules menu) | owned by UC-SEC-001 | `not-applicable` here — the side-nav gate is UC-SEC-001's; the role half of BR-01 is **GAP-1** |
| Session expiry during entry | no UC-specific handling | `not-applicable` — unchanged; no schedule-specific timeout handling in the rewrite either |
| Browser Back after partial entry | no `ViewExpiredException` guard | `not-applicable` — a client-side SPA route; no equivalent failure mode |
| File-upload workflow variations (7 of them) | Schedule 3 is a direct-entry form | `not-applicable` — unchanged |
| "Re-upload after failure" | already covered by S17's retry | `covered` — `save-error.feature` asserts both arms |
| "Partial correction" after Check Status | mechanically identical to re-running S10 | `not-applicable` — unchanged |
| Exact boundary values at the range limits | "not a separately observable code path" | **Now covered** — the client validator makes the inclusive bound observable (see gains) |
| Uniqueness of row descriptions | "not enforced unique — no violation state exists" | `not-applicable` — unchanged (`other-costs` adds a row without any uniqueness check firing) |
| Casing dimension | no name-style rule in this field set | `not-applicable` — unchanged |
| Invalid enum for Override | a two-item `selectOneMenu` cannot submit an out-of-list value | `not-applicable` — unchanged (a two-item Carbon `Select`) |
| Missing PO&P for the three Harvest-only lines | a data point inside S10's field set | `covered` — S10 asserts exactly 11 Harvest + 8 PO&P checks, i.e. that those three have none |
| Delete cascading to the sub-page rows | "no distinct outcome from a plain delete" | `not-applicable` — and in the rewrite the DELETE removes the summary itself, so re-opening 404s (asserted in `delete.feature`) |

## Symmetry checks performed

The mirror-matrix smell test — one arm covered but not the other:

| Pair | Both arms covered? |
|---|---|
| Save succeeds / Save fails | yes — `happy-path` ∥ `save-error` |
| Save fails / retry after the failure clears | yes — `save-error` both arms |
| Check Status MET / has issues | yes — `@S09` ∥ `@S10`/`@S11`/`@S12` |
| Check Status missing — main page / sub-page rows | yes — `@p0 @S10` ∥ `@p1 @S10` |
| Harvest<PO&P flagged — fixed line / other-acceptable row | yes — `@S11` ∥ `@S12` mirror |
| Override N (flagged) / Override Y (suppressed) | yes — `check-harvest-pop` + `check-oa-pop` ∥ `check-override` |
| BR-09 applied (WRN-001) / not applied (WRN-002) | yes — `crown-push` both scenarios, each with its Schedule 1 read-back |
| Delete confirmed / cancelled | yes — `delete.feature` both scenarios |
| Editable (Draft) / read-only (non-Draft) | yes — every editable scenario ∥ `render-states` `@S15` |
| Read-only **Submitted** / **Verified** | yes — the `@S15` outline runs both track codes |
| Read-only main page / read-only sub-page | yes — `@p1 @S15` outline ∥ `@p2 @S15` |
| Value out of range / on the inclusive bound | yes — reject outline ∥ recovery scenario, for costs and volumes |
| Out of range / not a number | yes — both are Examples rows of the same outlines |
| Rejection on the main page / on a sub-page | yes — `@S20`/`@S22` ∥ `@S21`/`@S23`/`@S24` |
| Blank description refused — Other Acceptable / Included Unacceptable | yes — `@S23` ∥ `@S24` |
| Sub-page row added / edited / removed | yes — all three in `other-costs` `@S04`, each read back; the missing removal confirm is the DIV-5 red |
| Count on the link / rows on the sub-page | yes — asserted on both sides of every navigation (the +1 for Annual Rents is legacy-faithful) |
| Client-rejected write / server-rejected write | yes — `validation` (spy proves 0 requests) ∥ `save-error` (500, read-back proves nothing stored) |
| Guard 409 (closed mill) / 404 (no report-status row) | yes — `render-states` `@S14` ∥ `@S16` |
| Schedule exists / schedule was never started | yes — every scenario ∥ `no-create` (the RED that found DIV-1) |
| Blank amounts accepted at Save / caught by Check Status | yes — the mutating anchors save empty at cleanup ∥ `@p0 @S10` |

## Test-quality DoD (RV) — self-audit

Audited against the skill's `quality-and-coverage-gates.md` §A on 2026-08-25. **No HIGH findings.**

| Rule | Verdict |
|---|---|
| No hard waits | **pass** — zero `waitForTimeout`/`sleep` anywhere in `steps/sch3`, `pages/sch3`, the fixture or the preflight; every wait is a web-first assertion or `expect.poll`, and the zero-write barrier is event-driven (`settleBeforeReadingSpy`) |
| No flow conditionals | **pass with two commented exceptions** — `schedule3Page.lineCells` and `overheadCells` branch on whether a cell holds an input, so ONE helper reads both the editable and the read-only render. They select a *read strategy*, never a path through an assertion, and cannot mask a wrong render mode (that is asserted separately by counting inputs). The only other branches are the cleanup registry's fail-loud `try/catch`, the mutation spy's method filter, the patch-restore's "is the summary missing?" check, and label lookups that throw on an unknown name — none steer a test |
| Deterministic, unique data | **pass** — no `Math.random()`/`Date.now()`, no hardcoded dates (this UC has no date fields); every mutating scenario owns a dedicated anchor, so fixed literals cannot collide |
| Isolated & self-cleaning | **pass** — a fail-loud cleanup registry restores each anchor to EMPTY through the app's own endpoints and re-reads to prove it (line amounts, both volumes, comments, Override, sub-page rows); the destructive delete re-applies the seed patch, since the app cannot recreate a summary; the crown anchor's Schedule 1 volumes are cleared and proven empty. Distinctness is asserted by preflight |
| Explicit assertions | **pass** — every `expect()` is in a step body or a page-object readiness/guard helper; page-object methods return values, never booleans standing in for assertions |
| Prove the negative | **pass** — every client-side rejection asserts the mutation spy saw **zero** writes *after crossing the shared settle barrier* (so the negative holds over a window, not at one instant) **and** that the stored record is still empty; the server-side rejection asserts the failure banner, the unchanged lock token, and the absent record |
| Poll UI-triggered read-backs | **pass** — every read-back after a click uses bounded `expect.poll` (stored amounts, derived figures, sub-page rows, counts, the crown push, the post-delete 404); never a single-shot GET |
| Resilient selectors | **pass** — `getByRole` for the tables, buttons, dialogs, row inputs and notifications; stable app-exposed `#id`s for the form fields; row addressing is by ROW ORDER resolved from the row's description (the row ids are client-side mount counters, not server ids), and the 11 fixed lines are addressed by their fixed positional order rather than by a label that is also a substring of another cell |
| Reuse over duplication | **pass** — the Home working-context Given and the five common message/error/warning/URL assertions are reused from `steps/common/`; the zero-write barrier is the promoted `pages/common/settle.ts`; ONE page object and ONE step set serve both sub-pages (the app renders them from one generic component), and repeated behaviour is a `Scenario Outline` (4 of them). No DOM selector appears in a step. One deliberate step rename — `I open the Schedule 3 Other Costs sub-page` — because Schedule 1 owns the unprefixed phrasing |
| Focused (~<300 lines/file) | **LOW deviation, logged not fixed** — `steps/sch3/schedule3.steps.ts` is ~640 lines. This matches the established house shape for a domain's main step file (`sch4` 767, `sch11` 744, `sch1` 599, `sch2` 596) and the file is already split by concern (`subPage.steps.ts`, `checkStatus.steps.ts`) with DOM detail in the page objects and data in the fixture. Splitting further purely to hit the number would diverge from five sibling domains for no readability gain |

## Coverage gate (TR)

- **P0: 100%** — all 5 P0 items exercised: the happy path (entry, save, full derived arithmetic, reload),
  the BR-09 crown push, both Check Status headline outcomes, and the DIV-1 divergence (RED on purpose,
  which **counts as covered** — it maps to S16 and is the tracking signal).
- **P1: 100%** of P1 items covered — 27 tests: 25 green plus the DIV-5 and DIV-6 reds, which **count as covered** (they map to S04's confirm-before-delete and S12's evaluate-the-screen, and are red on purpose).
- **Overall: 22/24 slices `covered`, 2 `not-applicable`** (S18/S19, DIV-3 closed — the state cannot exist in the
  rewrite). Every message-catalog row is dispositioned: covered, `not-applicable` with a reason, or
  `deferred` (the page-fallback strings, which belong in Vitest). The three `deferred`/`blocked` items
  (GAP-1 role-only read-only, GAP-2 optimistic-lock conflict, GAP-3 sub-page Back prompt) are none of
  them P0/P1-critical.
- **Verdict: PASS** — no waiver needed. GAP-1 is an environment limitation (single-role mock auth) and a
  gate should treat it as waived; GAP-2 and GAP-3 are tracked additions, not app problems.

## Accessibility (NFR1 / issue #83 AC2)

Four structurally distinct renders are swept and **all four are clean — zero WCAG 2.1 AA violations, so
there is nothing to triage**: the populated editable schedule (20 inputs, a `Select`, two tables, two
count links), both populated sub-pages (an Add panel plus an edit-everything-inline grid, one with a
disabled meta field), and the read-only schedule (every figure as text, all actions disabled).

The scan parks the pointer before measuring, so `color-contrast` is judged on the resting state. The
app-wide hover/row-contrast defect (bcgov/nr-ilcr#314) is therefore not re-found here — it is already
tracked, and re-finding it in five domains adds nothing. The **validation-error** state is deliberately
not swept either: it would re-find the already-tracked app-wide Carbon `aria-errormessage` defect
(`KNOWN_A11Y_RULES` in `pages/common/axe.ts`, `sch11/…/defects.md` BUG-1).
