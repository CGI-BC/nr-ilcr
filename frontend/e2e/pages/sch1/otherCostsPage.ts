import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Subtotal Other Costs sub-page (components/schedule1OtherCosts/index.tsx), reached from the main
 * Schedule 1 page. Add form is `#add-description` / `#add-cost` / the "Add" button (rendered only when
 * editable); rows live in the aria-labelled "Other Costs" table with per-row Edit/Delete buttons; a
 * Carbon danger Modal ("Delete other cost") confirms a remove. Selectors live here, never in steps.
 */
export class OtherCostsPage {
  constructor(private readonly page: Page) {}

  /** The aria-labelled rows table — present once the sub-page GET resolves. */
  get table(): Locator {
    return this.page.getByRole('table', { name: 'Other Costs' });
  }

  get addDescription(): Locator {
    return this.page.locator('#add-description');
  }

  get addCost(): Locator {
    return this.page.locator('#add-cost');
  }

  get addButton(): Locator {
    return this.page.getByRole('button', { name: 'Add', exact: true });
  }

  get backButton(): Locator {
    return this.page.getByRole('button', { name: 'Back to Schedule 1' });
  }

  /** Readiness anchor after navigating in from Schedule 1. */
  async expectLoaded(): Promise<void> {
    await expect(this.table).toBeVisible();
  }

  /** Fill the add form and submit (S09/S10/S11). Blank cells are still typed (to clear). */
  async addRow(description: string, cost: string): Promise<void> {
    await this.addDescription.fill(description);
    await this.addCost.fill(cost);
    await this.addButton.click();
  }

  /** A table row located by its (unique) description text. */
  rowByText(text: string): Locator {
    return this.table.getByRole('row').filter({ hasText: text });
  }

  /** Delete a listed row by description: its danger Delete button, then the confirm Modal's Delete. */
  async deleteRow(text: string): Promise<void> {
    await this.rowByText(text).getByRole('button', { name: 'Delete' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Delete other cost' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
  }

  async backToSchedule1(): Promise<void> {
    await this.backButton.click();
  }
}
