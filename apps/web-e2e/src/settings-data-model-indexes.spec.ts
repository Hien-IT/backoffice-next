// Spec 030 (US1, US4, FR-022, T066): the Indexes card of the collection page. At proxy-api and cors: add a unique
// composite index through the dialog (field select into the sortable list, Move up from the row menu, the Unique
// switch), wait for Ready, a duplicate pair is refused by the API with one error per field, deleting a field names the
// indexes dropped with it, delete an index. At proxy-directus (the API is Directus) the card is not there.
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX, e2eConfig } from './helpers/config.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

const P = DATA_PREFIX.replaceAll('-', '_');
const C = `${P}_idx`;
const UNIQUE = `${C}_provider_provider_subject_unique`;

test.describe.configure({ mode: 'serial' });

let api: AdminApi;

async function cleanup() {
	await api.call('DELETE', `/collections/${C}`).catch(() => undefined);
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	await cleanup();
	const id = { field: 'id', type: 'integer', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } };
	await api.call('POST', '/collections', {
		data: {
			collection: C,
			schema: {},
			meta: {},
			fields: [
				id,
				{ field: 'provider', type: 'string', meta: {} },
				{ field: 'provider_subject', type: 'string', meta: {} },
				{ field: 'name', type: 'string', meta: {} },
			],
		},
	});
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterAll(async () => {
	await cleanup();
});

async function signIn(page: Page) {
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(CONTENT_URL);
}

const card = (page: Page) => page.getByTestId('collection-indexes');

async function openCollection(page: Page) {
	await page.goto(`/admin/settings/data-model/${C}`);
	await expect(page.getByRole('heading', { name: 'Fields & Layout' })).toBeVisible();
}

async function scan(page: Page) {
	await page.addStyleTag({
		content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
	});
	const results = await new AxeBuilder({ page })
		.include('[data-testid="collection-indexes"], [role="dialog"]')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
		.analyze();
	return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

test('no Indexes card when the API is Directus (proxy-directus)', async ({ page }) => {
	test.skip(e2eConfig !== 'proxy-directus', 'the card exists at Backoffice only');
	await signIn(page);
	await openCollection(page);
	await expect(card(page)).toHaveCount(0);
});

test('add a unique composite index, wait for Ready, the API refuses a duplicate pair with one error per field', async ({
	page,
}) => {
	test.skip(e2eConfig === 'proxy-directus', 'the card exists at Backoffice only');
	await signIn(page);
	await openCollection(page);
	await expect(card(page)).toBeVisible();
	await expect(card(page)).toContainText('No indexes yet');
	expect(await scan(page)).toEqual([]);

	await card(page).getByRole('button', { name: 'Add index' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	const fieldSelect = dialog.getByRole('combobox').first();
	await fieldSelect.click();
	await page.getByRole('option', { name: /provider subject/i }).click();
	await fieldSelect.click();
	await page.getByRole('option', { name: 'Provider', exact: true }).click();
	await expect(dialog.locator('[data-row-key]')).toHaveCount(2);

	// Keyboard reorder through the row menu: provider first.
	await dialog.getByRole('button', { name: 'Options for Provider', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Move up' }).click();
	await expect(dialog.locator('[data-row-key]').first()).toHaveAttribute('data-row-key', 'provider');

	await dialog.getByRole('switch', { name: /Unique/ }).click();
	expect(await scan(page)).toEqual([]);
	await dialog.getByRole('button', { name: 'Create' }).click();
	await expect(dialog).toHaveCount(0);

	await expect(card(page)).toContainText(UNIQUE);
	await expect(card(page).getByText('Ready')).toBeVisible({ timeout: 90_000 });

	await api.call('POST', `/items/${C}`, { data: { provider: 'zz', provider_subject: 'zz' } });
	const refused = await api
		.call('POST', `/items/${C}`, { data: { provider: 'zz', provider_subject: 'zz' } })
		.then(() => null)
		.catch((error: unknown) => String(error));
	expect(refused).toContain('RECORD_NOT_UNIQUE');
	expect(refused).toContain('"field":"provider"');
	expect(refused).toContain('"field":"provider_subject"');
});

test('deleting a field names the indexes dropped with it; they are gone afterwards', async ({ page }) => {
	test.skip(e2eConfig === 'proxy-directus', 'the card exists at Backoffice only');
	await signIn(page);
	await openCollection(page);
	await expect(card(page)).toContainText(UNIQUE);

	await page.getByRole('button', { name: 'Options for provider_subject', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Delete Field' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('These indexes will be dropped');
	await expect(dialog).toContainText(UNIQUE);
	await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

	await expect(card(page)).toContainText('No indexes yet');
	await expect
		.poll(async () => (await api.call<{ name: string }[]>('GET', `/backoffice/collections/${C}/indexes`)).length)
		.toBe(0);
});

// The web env runs Postgres: the trigram type is offered (T067); Delete from the row button afterwards.
test('add a trigram index on a string field and delete it from the card', async ({ page }) => {
	test.skip(e2eConfig === 'proxy-directus', 'the card exists at Backoffice only');
	await signIn(page);
	await openCollection(page);

	await card(page).getByRole('button', { name: 'Add index' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('combobox').first().click();
	await page.getByRole('option', { name: 'Name', exact: true }).click();
	await dialog.getByRole('combobox').nth(1).click();
	await page.getByRole('option', { name: /Trigram/ }).click();
	await expect(dialog.getByRole('switch', { name: /Unique/ })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Create' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(card(page)).toContainText('Trigram');
	await expect(card(page).getByText('Ready')).toBeVisible({ timeout: 90_000 });

	await card(page).getByRole('button', { name: `Delete: ${C}_name_trgm` }).click();
	await expect(page.getByRole('dialog')).toContainText(`${C}_name_trgm`);
	await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(card(page)).toContainText('No indexes yet');
});
