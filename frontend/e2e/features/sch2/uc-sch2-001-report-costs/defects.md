# Defects — UC-SCH2-001 Report Purchased and Private Log Costs and Sales (Schedule 2)
> How this log works (registers, tags, per-register templates): [defects-guide.md](../../../defects-guide.md)

**First authored: 2026-08-13** (Story 3.4). Every entry below was verified against the running app and the
seeded local delivery DB on that date — none are carried forward from another UC on trust.

**Headline: one genuine Schedule 2 bug found (BUG-1, carried as a deliberate RED), and one real
divergence.** 38 of 39 tests pass; the single red is BUG-1 — the **Delete** button is offered on a schedule
that has never been saved, contradicting BR-08/S06. It is a Schedule 2 fault (unlike Schedule 11's red,
which is an app-wide Carbon defect), it was found by this suite, and it is not ours to fix or adjudicate.
Beyond that, Schedule 2 behaved correctly on every path exercised, including the full derived-figure
arithmetic, both Check Status arms, the context guards and the rollback-on-failure path.

Because Schedule 2 was **rebuilt rather than ported**, one behaviour genuinely differs from the legacy
Gherkin — **DIV-1**, derived totals refresh on Save rather than as you type. It is almost certainly
intended (it follows ratified architecture decisions AD-5/AD-6) but it is user-visible, so it is recorded
for BA/QA rather than assumed away.

Two findings looked like divergences at first and were **disproved** by checking the service's documented
null-propagation and the delete contract. Both now sit in *Verified — not a defect* (**VER-1** absent-vs-zero
figures, **VER-2** idempotent delete) so the Divergence register lists only live differences.

**BA/QA own triage.** Nothing below has been adjudicated or ticketed by the test author. No application
source was changed while authoring this suite.

---

## Bug / Regression

- **BUG-1 — Delete is offered on a Schedule 2 that has never been saved.**
  _Found by this suite · Schedule 2's own fault · no data loss · misleading confirmation._
  - **What's wrong:** open Schedule 2 for a mill and year where no Schedule 2 has ever been saved. The page
    correctly shows an empty form — but the **Delete** button is active. There is nothing to delete.
    Pressing it opens the "This will delete the current record. Do you want to continue?" confirmation and,
    on confirming, the page reports **"Data deleted successfully"** for a record that never existed.
  - **The same fault has a second face:** immediately *after* a successful delete, Delete stays active
    rather than greying out, so the same already-deleted schedule can be "deleted" repeatedly, each time
    reporting success.
  - **Expected vs actual:** BR-08 / slice S06 say Delete is only offered when the schedule has actually
    been saved and is still editable — the legacy screen did not render the button at all until then.
    Actual: Delete is active for any editable schedule, saved or not.
  - **Evidence:** `frontend/src/components/schedule2/index.tsx:245` —
    `const deletable = editable && data.revisionCount !== null`. The intent is right, but the API omits null
    fields from its JSON entirely (Jackson `non_null`), so an unsaved schedule's `revisionCount` is
    **absent** and arrives as `undefined`. `undefined !== null` is `true`, so the gate always opens.
    Confirmed live 2026-08-13 — `GET /api/v1/schedule2?millId=25053&year=2017` returns no `revisionCount`
    key at all (`keys: editable, lessLogSales, millId, netPurchased, purchasedLogCost,
    purchasedWoodOverhead, subtotal, totalAverage, totalCompanyLogging, trackStatus, year`).
  - **Why the type checker missed it:** `frontend/src/interfaces/Schedule2Response.ts` declares
    `readonly revisionCount: number | null` — **not** optional — so the absent case was never modelled. A
    likely fix is to make it optional and compare with `data.revisionCount == null`, which catches both null
    and undefined. Note `buildRequest` already handles absence correctly via `doc.revisionCount ?? 0`, so
    only this gate is affected.
  - **Impact:** no data loss — the backend's delete is idempotent, so deleting a non-existent schedule is a
    server-side no-op (see VER-2). The harm is a misleading success message and a control that contradicts
    the documented rule: a reporter can be told data was deleted when nothing existed.
  - **Priority / env:** p1 · any never-saved Schedule 2 · local seeded delivery DB.
  - **Status:** OPEN — awaiting BA/QA triage. No Jira raised; the test author does not adjudicate.
  - **Test:** `render-states.feature` `@discovered-bug @p1 @S06` — "Delete is not offered for a never-saved
    schedule". A genuine RED that flips green on its own when the gate is fixed. Excluded from the
    documented gate: `npm run test:gate`.
  - **Why only one red for two faces:** the post-delete manifestation has the same root cause, so it is
    noted in a comment in `delete.feature` rather than given its own red — one red per defect keeps the
    signal readable, and a second copy would also drag the P0 delete journey out of the gate.

_No OTHER bugs found._ Every write, guard, validation and derived figure behaved as the contract specifies.
For the record, four things were probed directly against the API looking for trouble and each behaved
correctly: the full derived chain recomputes from entered values (Net Purchased = Subtotal − Log Sales,
Total Average = Net Purchased + Total Company) and matches the rendered figures to the cent; a second save
**overwrites** the two detail records rather than inserting a duplicate pair (revision 1 → 2); a blank cost
persists a real NULL that Check Status then reports; and DELETE restores the anchor to byte-identical
at-rest state.

---

## Divergence

> The app genuinely differs from what the legacy-derived Gherkin describes. **We do not change app source
> to match the spec, and we do not silently drop the spec's version** — each item below is asserted as the
> app actually behaves, and the legacy expectation is recorded here.

- **DIV-1 — Derived figures refresh on Save, not as you type.**
  - **What's different:** on the legacy screen, typing a cost or volume immediately updated the Subtotal,
    Net Purchased and Total Average lines — the totals moved as you typed. In the rebuilt page the totals do
    **not** move while you type; they update when you press **Save**.
  - **Expected vs actual:** slices S13/S14/S15 recovery arms say that after correcting a value "the
    `subtotalCal` / `netPurchasedCal` / `totalAverageCal` element updates" — i.e. on the field's own change
    event. Actual: those figures update only after a successful Save.
  - **How we caught it:** `components/schedule2/index.tsx` renders every derived cell from `data` (the
    server document) while typing only mutates `form`, so no client recomputation exists. Confirmed in the
    browser — the at-rest figures are still on screen after entry and before the Save.
  - **Is it a defect?** Almost certainly not. Every derived and carried figure is now computed server-side
    and never recomputed in the browser (architecture decisions **AD-5/AD-6**; the `Schedule2Service`
    javadoc is explicit that derived values are "computed here … never accepted from a client"). The legacy
    live-update depended on a per-keystroke AJAX round-trip the rewrite deliberately does not make.
  - **Why it is raised anyway:** it is a real, user-visible behaviour change from the spec this suite is
    written against, and only BA/QA can confirm that trading live totals for server-authoritative ones is
    acceptable to reporters. If it is, this entry moves to *Verified — not a defect* and the spec is
    annotated.
  - **Priority / env:** p2 (informational) · local seeded delivery DB.
  - **Status:** OPEN — for BA/QA confirmation that this is the intended UX.
  - **Test:** covered as the app behaves — `happy-path.feature` `@p0 @S01` asserts the at-rest figures are
    still shown *after* entry and *before* the Save, then the recomputed figures after it, so a change in
    either direction fails. No red, because this is traceable to a ratified architecture decision rather
    than a suspected fault.

---

## Coverage gap

> Things the use case asks for that this suite does **not** currently assert, each with the reason. None
> of these is a known fault; they are honest holes.

- **GAP-1 — There is no role-dependent Schedule 2 behaviour reachable from a browser.**
  - **Why not:** the mock auth used by the E2E environment grants a single role per process, so "a user
    without the Schedules permission is denied" cannot be produced from a browser.
  - **Already covered where it belongs:** server-side enforcement **is** present and is covered by
    `Schedule2AuthorizationIT`, `Schedule2WriteAuthorizationIT` and `Schedule2CheckStatusAuthorizationIT`.
  - **The legacy catalogue excluded the same item for a different reason** — it found no documented in-page
    behaviour for a direct-navigation bypass, so there was nothing to slice.
  - **Status:** OPEN — `blocked` in coverage.md. A gate should treat this as **waived**, not failing.
  - **Test:** none today, by environment limitation rather than by choice.

- **GAP-2 — The validation recovery arms assert acceptance, not recomputation.**
  - **What's missing:** legacy slices S13/S14/S15 each carry a recovery scenario whose tail asserts the
    totals update once a valid value is entered. The bound outlines here assert the value is **accepted**
    (no inline error) but not that figures update — because in this app they cannot until Save.
  - **Why:** this is DIV-1's consequence, not an independent hole. The recomputation itself is fully covered
    by `happy-path.feature`, which asserts every derived figure against real arithmetic.
  - **Status:** OPEN — superseded by **DIV-1**; closing it depends on DIV-1's disposition.
  - **Test:** `validation.feature` bound outlines cover the acceptance half (`@p2 @S13/@S14/@S15`).

- **GAP-3 — Two page-level fallback messages are untested.**
  - **What's missing:** `Unable to load Schedule 2.` and `Unable to delete Schedule 2.` are fallbacks the
    page shows only when the API fails *and* returns no `ProblemDetail.detail`.
  - **Why it is low value:** every realistic failure the app produces carries a detail — proved by the 409
    and 404 guard scenarios, which assert the server's own wording verbatim. Reaching these strings needs a
    second route-interception fixture for little behavioural gain.
  - **Status:** OPEN — `deferred` in coverage.md. Deferred rather than dropped.
  - **Test:** none today. The equivalent *save* fallback (ERR-003) **is** covered, by
    `save-error.feature` `@p1 @S12`.

- **GAP-4 — The validation-error state is not swept by axe here, deliberately.**
  - **What's missing:** Schedule 2's accessibility sweep covers four renders (editable-and-populated,
    read-only, the Check-Status result, a guard state) but omits the validation-error state.
  - **Why:** sweeping it would re-find a single already-triaged, **app-wide** defect — Carbon's `TextInput`
    invalid state wires `aria-errormessage` to an element it never announces (axe rule
    `aria-valid-attr-value`, impact critical), so a field error never reaches assistive technology. It
    affects every schedule page, is recorded in `deferred-work.md`, and is already carried as the standing
    red in `features/sch11/uc-sch11-001-report-costs/accessibility.feature` (that UC's BUG-1).
  - **One red per app-wide defect is the tracking signal;** a second copy per schedule would degrade it into
    noise. This is a deliberate scoping decision, recorded so it is explicit and reversible rather than a
    silent omission.
  - **Does it block the AC?** No. Story 3.4 AC2 is "zero violations **or** triaged exceptions" — the
    `deferred-work.md` entry is that disposition, and Schedule 2's four swept renders are clean.
  - **Status:** OPEN — reversible. When the app-wide fix lands, remove `aria-valid-attr-value` from
    `KNOWN_A11Y_RULES` in `pages/common/axe.ts`; adding the sweep here is then trivial and both go green
    together.
  - **Test:** four clean sweeps in `accessibility.feature`; the fifth state intentionally not swept.

- **GAP-5 — Follow-up for the app team: the CI workflow comment lists a stale domain set.**
  - `.github/workflows/reusable-tests.yml` explains that only the data-independent `@smoke` project runs
    in CI and that "the full data-backed suite (setup + chromium — **SCH1/SEC**) is a LOCAL/manual gate".
    That parenthetical is now out of date: the data-backed suite also covers **sch11** (merged in
    bcgov/nr-ilcr#276) and **sch2** (this work).
  - **Why it matters (mildly):** the comment is the first thing a reader consults to learn what the manual
    gate actually covers, so an understated list makes the gate look narrower than it is. Nothing
    functional depends on it — the job itself greps `@smoke` and is unaffected.
  - **Why we did not just fix it:** this suite changes no files outside `frontend/e2e/` — that is a hard
    rule, and a CI workflow is the app team's to edit.
  - **Priority / env:** p3 (comment only) · CI config.
  - **Status:** OPEN — raised for the app team; a one-line comment edit whenever they are next in that file.
  - **Test:** none owed — documentation drift, not behaviour.

---

## Spec gap

> The requirements/Gherkin do not describe behaviour the app genuinely has. These feed back to the BA, not
> to the dev team.

_None._ The `.feature` set under `tests/UC-SCH2-001/gherkin/` faithfully reflects its own source documents:
all 16 slices in the catalogue have a feature file, and the 21 scenarios match the slice descriptions
(including the recovery arms for S09, S10, S12, S13, S14 and S15). The reconciliation in `coverage.md`
found no scenario the sources list but the Gherkin omits.

Worth recording for the BA even though it is not a gap: the rewrite made **ERR-004 "Schedule not found."**
reachable, which the legacy UC and technical sidecar had both flagged as an `[ASSUMPTION]`-level
unreachable state and therefore modelled no slice for. It is now covered by
`render-states.feature` `@p2 @S10`. A slice is not owed — the behaviour is covered by test — but a BA
re-grounding this UC later should know the exclusion no longer holds.

---

## Verified — not a defect

> Checked because something looked wrong or unknown, and confirmed correct. Recorded so nobody re-opens
> them.

- **VER-1 — Blank fields produce *absent* figures, not zeros.**
  - **Why it looked wrong:** slice S04 says the Net Purchased and Total Average figures "compute using zero
    for the log-sales offset". The app instead leaves the volume and $/m³ cells **empty** (an em dash) and
    carries the cost through unchanged, which reads at first like a lost calculation.
  - **What we found:** it is correct. The service's documented null-propagation mirrors the legacy
    `CoreUtil` — subtraction returns the minuend when the subtrahend is null, and addition returns the
    non-null operand — so with no log-sales values the net is the subtotal *unreduced*. That is exactly the
    "zero offset" outcome S04 describes, expressed as "no value" rather than a literal 0.
  - **Evidence:** probe 2026-08-13 — `PUT` cost 8000 with both log-sales fields null →
    `netPurchased {cost: 8000}`, no volume, no perUnit.
  - **Verdict:** Not a defect — deliberate legacy fidelity. **Now asserted as-is** by
    `blank-fields.feature` `@p1 @S04`.
  - **Status:** CLOSED as verified 2026-08-13.

- **VER-2 — Delete on a schedule with no summary returns success rather than 404.**
  - **Why it looked wrong:** calling DELETE for a mill/year that has never had a Schedule 2 answers 200
    with "Data deleted successfully", which looks like the app confirming work it did not do.
  - **What we found:** it is deliberate and documented — `Schedule2Service.deleteSchedule2` returns early
    when no summary exists, so DELETE is idempotent by contract. Schedule 2 never 404s on its own summary
    (unlike Schedule 1, whose read does).
  - **Verdict:** Not a defect. **It is not BUG-1 either** — BUG-1 is that the *button* is offered in the
    first place, which is a frontend gating fault. The idempotent endpoint is the correct backend
    behaviour, and it is exactly what makes cleanup safe: the suite restores every mutating anchor by
    calling DELETE unconditionally.
  - **Status:** CLOSED as verified 2026-08-13.
