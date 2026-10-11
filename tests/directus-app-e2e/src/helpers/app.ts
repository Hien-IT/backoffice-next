// Small steps of the Directus app 11.17.4 UI shared by the specs.
import { expect, type Locator, type Page } from '@playwright/test';

/** Directus asks an admin without a project owner to set one: "Remind Later" closes it without accepting anything. */
export async function dismissOwnerDialog(page: Page): Promise<void> {
	const later = page.getByRole('button', { name: 'Remind Later' });
	if (await later.isVisible().catch(() => false)) await later.click({ timeout: 5_000 }).catch(() => undefined);
}

/** The `.field` of a form whose label is `label`. */
export function field(page: Page | Locator, label: string): Locator {
	return page.locator('.field').filter({ has: page.locator('.field-label', { hasText: new RegExp(`^${label}`) }) });
}

/** The save button of the header bar (check icon). */
export function saveButton(page: Page): Locator {
	return page
		.locator('header button')
		.filter({ has: page.locator('i[data-icon="check"]') })
		.first();
}

export async function save(page: Page): Promise<void> {
	await saveButton(page).click();
	await expect(page.locator('.v-notification, .notifications-group').first())
		.toBeVisible({ timeout: 15_000 })
		.catch(() => undefined);
}

/** Picks the row named `name` in the item drawer an m2o or m2m interface opens, then confirms. */
export async function pickInDrawer(page: Page, name: string): Promise<void> {
	const drawer = page.locator('.v-drawer').last();
	await drawer.locator('button.icon-search').click();
	await drawer.locator('input[placeholder="Search Items..."]').fill(name);
	await drawer.locator('tr.table-row', { hasText: name }).first().click();
	await drawer
		.locator('header button, .header-bar button')
		.filter({ has: page.locator('i[data-icon="check"]') })
		.first()
		.click();
}

/** Deletes the item open in the page (header delete icon, then the confirmation). */
export async function deleteOpenItem(page: Page): Promise<void> {
	await page
		.locator('header button')
		.filter({ has: page.locator('i[data-icon="delete"]') })
		.first()
		.click();
	await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
}
