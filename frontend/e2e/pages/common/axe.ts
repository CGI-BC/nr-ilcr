import { type Page, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Accessibility gate shared by every domain (NFR1 / issue #74 AC4 / HOME-1.5 AC4). Runs axe-core against
 * the current page and asserts ZERO WCAG 2.1 A/AA violations. The tag set is wcag2a + wcag2aa +
 * **wcag21a + wcag21aa**: the 2.0 tags alone silently exclude the 2.1-only rules (autocomplete-valid,
 * label-content-name-mismatch, …), so a "2.1 AA" claim needs the 2.1 tags too (the same correction the
 * app team's Story 1.5 review applied). Any violation is printed (rule + impact + nodes + help URL) so a
 * real finding can be triaged with a recorded disposition rather than failing opaquely.
 *
 * ONE EXCEPTION to that printing: a scenario tagged `@discovered-bug` is a KNOWN, already-triaged red, so
 * dumping the full rule/node/help-URL block on every run is noise that reads like a fresh emergency. Those
 * pass `known: true` and get a single line instead. The assertion is unchanged — the test still fails,
 * because that failing state IS the tracking signal. Only the logging is quieter.
 *
 * That quiet path is scoped BY RULE ID, not by the tag alone. `known: true` used to silence every
 * violation found in that scan, so a second, unrelated defect appearing in the same state would have been
 * folded into the one-line summary and lost among an expected red. Now only `KNOWN_A11Y_RULES` are
 * summarised; anything else still gets the full triage dump even inside a `@discovered-bug` scenario.
 * The quiet line still NAMES the offending nodes, so a fresh element failing an already-known rule cannot
 * pass for the tracked defect at a glance.
 */

const WCAG_2_1_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Rule ids for the app-wide accessibility defects already found, triaged and recorded, so a scan that
 * hits one of them can report it in a single line instead of a full dump.
 *
 * `aria-valid-attr-value` (impact: critical) — Carbon `TextInput`'s invalid state renders
 * `aria-errormessage` pointing at an element it never announces, so validation errors never reach
 * assistive technology. It is a `@carbon/react` wiring issue present in EVERY schedule page's
 * validation-error state, not a Schedule 11 fault; tracked in `deferred-work.md` and in
 * `features/sch11/uc-sch11-001-report-costs/defects.md` BUG-1. Remove the id here the moment the app-wide
 * fix lands — the scan then goes green on its own and the `@discovered-bug` tag comes off with it.
 */
export const KNOWN_A11Y_RULES: readonly string[] = ['aria-valid-attr-value'];

export interface A11yOptions {
  /**
   * Skip the pointer-parking below and scan with the pointer EXACTLY where the scenario left it.
   *
   * Only for a scan that is deliberately testing a pointer state (a hovered table row). Every other
   * caller wants the resting state, which is reproducible.
   */
  keepPointer?: boolean;
  /**
   * True when the caller's scenario is a documented `@discovered-bug` red (see the UC's defects.md).
   * Only violations whose rule id is in `KNOWN_A11Y_RULES` are then logged quietly; a violation outside
   * that list is treated as a fresh finding and printed in full regardless.
   */
  known?: boolean;
}

export async function assertNoA11yViolations(
  page: Page,
  label: string,
  opts: A11yOptions = {},
): Promise<void> {
  // PARK THE POINTER FIRST — determinism, not cosmetics.
  //
  // axe's `color-contrast` rule measures the COMPOSITED background, so a row the mouse happens to be
  // resting on is measured in its :hover state. Playwright leaves the pointer wherever the last click
  // left it, so without this the scan result depends on which control the scenario clicked last — the
  // same page could pass or fail run to run, and across domains (Carbon's table hover layer #e0e0e0
  // under a `ghost`/`danger--ghost` label measures 3.78:1, below 4.5:1). Found while authoring the
  // Schedule 4 sweeps 2026-08-17: the sub-page scan failed only because the pointer had come to rest
  // over a row after a modal closed.
  //
  // Scanning the RESTING state is what these sweeps are for, and it is reproducible. A hover-state rule
  // is worth testing too, but it must hover DELIBERATELY — see the Schedule 4 accessibility feature's
  // explicit row-hover scenario.
  //
  // WHY OFF-PAGE AND NOT (0, 0): this parked at (0, 0) until 2026-08-21, which is NOT a resting position
  // — it is inside the fixed app header, directly over `button.cds--header__menu-toggle`, so every scan
  // in every domain measured the header in its HOVERED state (verified: 6 elements in `:hover`, deepest
  // `BUTTON.cds--header__action`). It happened not to change any verdict, but a future hover token on a
  // header control would have been swept in its hovered form and read as the resting one — the exact
  // failure this parking exists to prevent. Raised in review of the Schedule 4 suite.
  //
  // A negative coordinate is OUTSIDE the viewport, so the hit test finds nothing and the browser clears
  // the whole hover chain — `:hover` matches ZERO elements, not even `html`/`body`. That is inert by
  // construction rather than by luck of layout, which is why it beats hunting for a quiet in-page pixel:
  // no in-page point stays quiet across Home, every schedule, every sub-page and every panel state (a
  // long table puts a `td` under the bottom of the viewport). Viewport-independent too, so it does not
  // silently rot if `playwright.config.ts` changes its 1280x900.
  if (!opts.keepPointer) {
    await page.mouse.move(-1, -1);
    // PROVE the park rather than trusting the coordinate. If a future Chrome/Playwright clamps an
    // out-of-viewport move back INTO the viewport, the pointer would land on the header again and
    // quietly reintroduce the hovered-header measurement above. This turns that regression into one
    // clear failure instead of a scan result that is wrong by 70ms of fade.
    const hovered = await page.evaluate(() => {
      const chain = Array.from(document.querySelectorAll(':hover'));
      const deepest = chain[chain.length - 1];
      return { count: chain.length, deepest: deepest ? deepest.tagName.toLowerCase() : null };
    });
    expect(
      hovered.count,
      `a11y scan "${label}": the pointer did not park off-page — ${hovered.count} element(s) still ` +
        `match :hover (deepest <${hovered.deepest}>), so this scan would measure a HOVERED state as ` +
        `if it were the resting one. See the parking rationale in pages/common/axe.ts.`,
    ).toBe(0);
  }
  const results = await new AxeBuilder({ page }).withTags(WCAG_2_1_AA_TAGS).analyze();
  const { violations } = results;
  // Split by rule id, not by the caller's tag: an expected red must never hide an unexpected one.
  const known = opts.known ? violations.filter((v) => KNOWN_A11Y_RULES.includes(v.id)) : [];
  const fresh = violations.filter((v) => !known.includes(v));

  if (known.length > 0) {
    // Already triaged: one line per rule, no help-URL/impact dump. The expect() below still fails.
    //
    // The NODE TARGETS are named even here. Quieting by rule id alone means a second, unrelated element
    // failing the SAME rule is folded into "1 KNOWN violation" and read as the tracked defect — the
    // gate never hides it (the assertion below counts every violation), but the triage line would
    // misattribute it. Printing the targets makes a new node visible at a glance instead of requiring
    // someone to open the trace to notice the count moved.
    for (const v of known) {
      console.log(
        `axe: KNOWN violation ${v.id} on ${label} — expected RED, see this UC's defects.md. ` +
          `nodes(${String(v.nodes.length)}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
      );
    }
  }
  if (fresh.length > 0) {
    const report = fresh
      .map(
        (v) =>
          `  [${v.impact ?? 'n/a'}] ${v.id}: ${v.help}\n` +
          `      nodes: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}\n` +
          `      ${v.helpUrl}`,
      )
      .join('\n');
    // Surfaced in the test output/trace so BA/QA can triage each finding (NFR1 disposition). Reached even
    // in a `@discovered-bug` scenario when the rule is not one of the recorded ones.
    console.error(`axe WCAG 2.1 AA violations on ${label}:\n${report}`);
  }
  expect(
    violations.map((v) => v.id),
    fresh.length > 0
      ? `WCAG 2.1 AA violations on ${label} — fix, or record a disposition per NFR1` +
          (known.length > 0
            ? ` (NEW: ${fresh.map((v) => v.id).join(', ')}; the other ${String(known.length)} are already tracked)`
            : '')
      : `KNOWN WCAG violation(s) on ${label} — expected RED, tracked in this UC's defects.md`,
  ).toEqual([]);
}
