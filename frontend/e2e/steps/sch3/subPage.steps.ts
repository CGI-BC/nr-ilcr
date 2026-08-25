import { When, Then, expect } from '../fixtures';
import { settleBeforeReadingSpy } from '../../pages/common/settle';
import {
  OA_ROW,
  OA_ROW_EDITED_TOTAL,
  UNACCEPTABLE_ROW,
} from '../../fixtures/sch3/schedule3-test-data';
import { getOtherAcceptable, getUnacceptable } from './schedule3Api';

/**
 * UC-SCH3-001 — the two Schedule 3 cost sub-pages (AF1 / AF2 and their exception paths).
 *
 * One step set serves both pages because the rewrite renders them from one generic component; the
 * scenario names which page it is on (`world.sch3SubPageTitle`, set by the navigation step), so a step
 * never has to repeat it. Every selector lives in `pages/sch3/schedule3SubPage.ts`.
 *
 * The sub-page persistence model the assertions rely on (`hooks/useEditableCostRows`): Add, Remove and
 * Save each PUT the WHOLE row set and the server reconciles insert/update/delete. A row that fails the
 * advisory validation is never sent — which is what the zero-write assertions prove.
 */

const title = (world: { sch3SubPageTitle?: string }): string => {
  expect(
    world.sch3SubPageTitle,
    'no sub-page is open — a navigation step must run before this one',
  ).toBeTruthy();
  return world.sch3SubPageTitle!;
};

// ---------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------

When('I add an other-acceptable cost row', async ({ schedule3SubPage, world }) => {
  await schedule3SubPage.addRow({
    description: OA_ROW.description,
    total: String(OA_ROW.total),
    pop: String(OA_ROW.pop),
  });
  world.sch3RowDescription = OA_ROW.description;
});

When('I add an included-unacceptable cost row', async ({ schedule3SubPage, world }) => {
  await schedule3SubPage.addRow({
    description: UNACCEPTABLE_ROW.description,
    total: String(UNACCEPTABLE_ROW.total),
  });
  world.sch3RowDescription = UNACCEPTABLE_ROW.description;
});

When(
  'I add a sub-page row with no description and a total of {string}',
  async ({ schedule3SubPage }, total) => {
    await schedule3SubPage.addRow({ description: '', total });
  },
);

When(
  'I add a sub-page row described {string} with a total of {string}',
  async ({ schedule3SubPage, world }, description, total) => {
    await schedule3SubPage.addRow({ description, total });
    world.sch3RowDescription = description;
  },
);

When('I change the added row total to the edited value', async ({ schedule3SubPage, world }) => {
  await schedule3SubPage.editRowValue(
    title(world),
    world.sch3RowDescription!,
    'total',
    String(OA_ROW_EDITED_TOTAL),
  );
});

When('I save the sub-page', async ({ schedule3SubPage }) => {
  await schedule3SubPage.save();
});

When('I remove the added row', async ({ schedule3SubPage, world }) => {
  await schedule3SubPage.removeRow(title(world), world.sch3RowDescription!);
});

When('I go back to Schedule 3', async ({ schedule3SubPage }) => {
  await schedule3SubPage.back();
});

When('I note the sub-page write count', async ({ schedule3MutationSpy, world }) => {
  world.sch3MutationsBefore = schedule3MutationSpy.mutations;
});

// ---------------------------------------------------------------------------------------------------
// Assertions — the rendered sub-page
// ---------------------------------------------------------------------------------------------------

Then('the sub-page lists the added row', async ({ schedule3SubPage, world }) => {
  await expect
    .poll(async () => schedule3SubPage.descriptions(title(world)), {
      message: `"${world.sch3RowDescription}" never appeared in the "${title(world)}" list`,
    })
    .toContain(world.sch3RowDescription!);
});

Then('the sub-page no longer lists the added row', async ({ schedule3SubPage, world }) => {
  await expect
    .poll(async () => schedule3SubPage.descriptions(title(world)), {
      message: `"${world.sch3RowDescription}" is still listed after the removal`,
    })
    .not.toContain(world.sch3RowDescription!);
});

Then('the sub-page shows no records', async ({ schedule3SubPage, world }) => {
  await expect(schedule3SubPage.emptyState(title(world))).toBeVisible();
});

Then(
  'the added row shows a total of {string} and a Crown of {string}',
  async ({ schedule3SubPage, world }, total, crown) => {
    await expect
      .poll(
        async () => [
          await schedule3SubPage.rowValue(title(world), world.sch3RowDescription!, 'total'),
          await schedule3SubPage.rowDerivedCell(title(world), world.sch3RowDescription!, 'Crown'),
        ],
        { message: `the added row never showed total ${total} / Crown ${crown}` },
      )
      .toEqual([total, crown]);
  },
);

Then('the sub-page Totals row shows {string}', async ({ schedule3SubPage, world }, expected) => {
  await expect
    .poll(async () => (await schedule3SubPage.totalsCells(title(world))).join(' / '), {
      message: `the "${title(world)}" Totals footer never showed ${expected}`,
    })
    .toBe(expected);
});

Then(
  // The parentheses are ESCAPED: an unescaped "(" opens an optional group in a Cucumber expression, so
  // the step would silently never match the literal label.
  'the Annual Rents \\(Forest Act, S111) figure shows {string}',
  async ({ schedule3SubPage }, expected) => {
    expect(await schedule3SubPage.annualRentsS111Value()).toBe(expected);
    // BR-04/BR-07: the figure is carried from the main page's Annual Rents Harvest amount and is never
    // enterable here.
    await expect(schedule3SubPage.annualRentsS111).toBeDisabled();
  },
);

Then('the sub-page row is not added', async ({ schedule3SubPage, world }) => {
  await expect(schedule3SubPage.emptyState(title(world))).toBeVisible();
});

Then('the sub-page rows are read-only', async ({ schedule3SubPage, world }) => {
  // Proven by counting what IS rendered: the read-only render has no row inputs and no Add panel.
  const editable = await schedule3SubPage
    .table(title(world))
    .getByRole('textbox', { name: 'Edit description' })
    .count();
  expect(editable, 'the read-only sub-page still renders editable row inputs').toBe(0);
  await expect(schedule3SubPage.addDescription).toHaveCount(0);
  await expect(schedule3SubPage.saveButton).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------------
// Assertions — the stored rows (API read-back)
// ---------------------------------------------------------------------------------------------------

Then('the stored other-acceptable rows are the added row', async ({ request, world }) => {
  await expect
    .poll(
      async () => {
        const doc = await getOtherAcceptable(request, world.scheduleKey!);
        return (doc.rows ?? []).map((r) => [r.description, r.total ?? null, r.pop ?? null, r.crown ?? null]);
      },
      { message: 'the added other-acceptable group was never stored' },
    )
    .toEqual([[OA_ROW.description, OA_ROW.total, OA_ROW.pop, OA_ROW.total - OA_ROW.pop]]);
});

Then('the stored other-acceptable row carries the edited total', async ({ request, world }) => {
  await expect
    .poll(
      async () => {
        const doc = await getOtherAcceptable(request, world.scheduleKey!);
        return (doc.rows ?? []).map((r) => [r.total ?? null, r.crown ?? null]);
      },
      { message: 'the in-place edit was never persisted' },
    )
    .toEqual([[OA_ROW_EDITED_TOTAL, OA_ROW_EDITED_TOTAL - OA_ROW.pop]]);
});

Then('the stored included-unacceptable rows are the added row', async ({ request, world }) => {
  await expect
    .poll(
      async () => {
        const doc = await getUnacceptable(request, world.scheduleKey!);
        return (doc.rows ?? []).map((r) => [r.description, r.total ?? null]);
      },
      { message: 'the added included-unacceptable row was never stored' },
    )
    .toEqual([[UNACCEPTABLE_ROW.description, UNACCEPTABLE_ROW.total]]);
});

Then('no other-acceptable rows are stored', async ({ request, world }) => {
  await expect
    .poll(async () => (await getOtherAcceptable(request, world.scheduleKey!)).count, {
      message: 'an other-acceptable group is still stored',
    })
    .toBe(0);
});

Then('no included-unacceptable rows are stored', async ({ request, world }) => {
  await expect
    .poll(async () => (await getUnacceptable(request, world.scheduleKey!)).count, {
      message: 'an included-unacceptable row is still stored',
    })
    .toBe(0);
});

Then('no sub-page write was attempted', async ({ page, schedule3MutationSpy, world }) => {
  // Same barrier as the main page's zero-write assertion: the negative must hold over a window, not at
  // one instant.
  await settleBeforeReadingSpy(page);
  expect(
    schedule3MutationSpy.mutations,
    'a mutating sub-page request was sent even though the row was rejected client-side',
  ).toBe(world.sch3MutationsBefore ?? 0);
});
