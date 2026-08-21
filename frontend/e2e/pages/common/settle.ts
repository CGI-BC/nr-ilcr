import { type Locator, type Page } from '@playwright/test';

/**
 * Barrier a "no write was sent" assertion crosses before reading a route spy — deterministic, NOT a
 * fixed sleep.
 *
 * PROMOTED to common/ 2026-08-14 when Schedule 2 landed. It was written for Schedule 11 and lived as a
 * module-local function in `steps/sch11/schedule11.steps.ts`; every domain with a mutation spy needs the
 * identical barrier, so it moved here rather than being re-inlined per domain (the suite's
 * reuse-over-duplication rule). Schedule 2 shipped its zero-write assertions WITHOUT it and a reviewer
 * caught the omission — the copy-paste-vs-promote decision is exactly what that near-miss argues for.
 *
 * WHY A BARRIER IS NEEDED AT ALL: the negative has to hold over a window, not at one instant. A
 * regression that renders the inline error and THEN fires the request a tick later would read a tally
 * of 0 and pass green.
 *
 * WHY NOT `waitForTimeout`: a wall-clock constant is tuned, not derived — too short and it flakes on a
 * loaded runner, too long and every rejection scenario pays for it. This waits on events instead, so it
 * is as fast as the app is and does not depend on machine speed:
 *   1. drain the page's own deferrals — pending microtasks, then one `MessageChannel` task (the queue
 *      React's scheduler yields through), then one timer task: between them they cover every way a click
 *      handler can defer work (promise chain, React commit/effect, `setTimeout`). Deliberately NOT
 *      `requestAnimationFrame`, which browsers throttle when the page is not visible — a headed run
 *      whose window is backgrounded would hang here rather than settle;
 *   2. then complete a real round-trip through the page's network stack. The spy is a Playwright route,
 *      and routes fire at request INITIATION in FIFO order, so any mutation the rejected action had
 *      already initiated is counted before this sentinel's response lands.
 *
 * The sentinel hits the app's own origin (index.html — no API, nothing mutated) and so is not counted by
 * any API-scoped spy. Residual limit: a mutation deferred past both queues AND a network round-trip would
 * still escape the tally — the persisted-state read-backs in the same scenarios are what catch that,
 * which is why every reject arm asserts BOTH the spy count and the absent/unchanged record.
 */
export async function settleBeforeReadingSpy(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => setTimeout(resolve, 0);
        channel.port2.postMessage(null);
      }),
  );
  await page.evaluate(async () => {
    await fetch(`${window.location.origin}/?e2e-no-write-barrier`, { cache: 'no-store' });
  });
}

/**
 * Barrier a COLOUR-SENSITIVE assertion crosses before reading a hovered/focused element — deterministic,
 * NOT a fixed sleep.
 *
 * WHY IT IS NEEDED: Carbon animates background-color on hover (`$duration-fast-02`, 70ms). axe and any
 * pixel sampling read the COMPOSITED background, so a scan fired immediately after the pointer moves
 * samples a mid-fade colour — lighter than the settled one, which UNDERSTATES a contrast failure and can
 * turn a real defect green by luck of timing.
 *
 * WHY NOT `waitForTimeout`: same reason as the spy barrier above — a wall-clock constant is tuned rather
 * than derived, so it flakes on a loaded runner and taxes every scenario on a fast one. This awaits the
 * page's own animation objects instead, so it is exactly as fast as the app's transition.
 *
 * WHY NOT `transitionend`: that event never fires when no transition runs (reduced-motion, or a property
 * that does not animate), so waiting on it risks a hang. `getAnimations()` returns an empty list in that
 * case and this resolves immediately.
 *
 * `subtree: true` because the paint that matters may be on a descendant (Carbon paints the row's hover on
 * the `tr` while the label lives in a `td` several levels down).
 *
 * WHY INFINITE ANIMATIONS ARE FILTERED OUT (added 2026-08-21, raised in review): an animation that loops
 * forever never resolves `finished`, so awaiting one would hang until the 60 s test timeout and report as
 * an opaque timeout rather than as anything diagnosable. The app has such an animation — Carbon's
 * `<Loading>` spinner, via `LoadingScreen` — and although it CANNOT collide with today's only call site
 * (that spinner is a whole-page early return, so when it is on screen there is no table and no row to
 * hover), this helper lives in `common/` precisely to be reused. A future caller passing a panel- or
 * page-level locator while a spinner is mounted would hit exactly that hang. Filtering costs nothing and
 * changes no current behaviour: a finite transition still gets awaited, an endless one is simply never
 * something that CAN settle, so waiting on it is meaningless as well as unsafe.
 *
 * `getComputedTiming()` rather than `getTiming()`: it resolves the `auto`/keyword forms to real numbers,
 * so the finite check reads what the animation will actually do.
 */
export async function settleTransitions(target: Locator): Promise<void> {
  await target.evaluate(async (el: Element) => {
    const running = el
      .getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().iterations));
    await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
  });
}
