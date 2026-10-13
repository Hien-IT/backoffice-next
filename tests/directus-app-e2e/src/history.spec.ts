// Feature 008 (spec FR-063, SC-006, contracts/parity.md §5): the history screens of the Directus app through the proxy,
// where /activity, /revisions, /versions and /comments go to the new app, write the same rows as Directus alone:
// revert a revision from the comparison of the revisions sidebar, post a comment, create a version and save into it,
// and open the activity module.
import { expect, type Page, test } from '@playwright/test';
import { field, saveButton } from './helpers/app.js';
import { closeHostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

const COLLECTION = 'e2e_history';

async function admin(method: string, path: string, body?: unknown) {
	const login = await fetch(`${DIRECTUS_URL}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;

	return fetch(`${DIRECTUS_URL}${path}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

test.beforeAll(async () => {
	await admin('DELETE', `/collections/${COLLECTION}`);
	const created = await admin('POST', '/collections', {
		collection: COLLECTION,
		schema: {},
		meta: { icon: 'history', versioning: true, accountability: 'all' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string', meta: { interface: 'input' } },
		],
	});
	expect(created.status).toBe(200);
});

test.afterAll(async () => {
	await admin('DELETE', `/collections/${COLLECTION}`);
	await closeHostDb();
});

/** Saves the form open in the page and waits for the request the app sends. */
async function saveAndWait(page: Page, path: RegExp, method: string): Promise<any> {
	const response = page.waitForResponse((r) => path.test(new URL(r.url()).pathname) && r.request().method() === method);
	await saveButton(page).click();
	const done = await response;
	expect(done.status(), `${method} ${path}`).toBe(200);
	return done.json().catch(() => undefined);
}

/** Opens a section of the item sidebar (Revisions, Comments) unless it is open already. */
async function openSidebar(page: Page, title: string): Promise<void> {
	const trigger = page.locator('.accordion-trigger', { hasText: title });
	if ((await trigger.getAttribute('data-state')) !== 'open') await trigger.click();
}

test('revert from the revisions sidebar, comment, version, activity', async ({ browser }) => {
	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			// An item with two revisions.
			await page.goto(`${url}/admin/content/${COLLECTION}/+`);
			await field(page, 'Title').locator('input').fill(`${tag} v1`);
			const created = await saveAndWait(page, new RegExp(`/items/${COLLECTION}$`), 'POST');
			const id = created.data.id as number;

			await page.goto(`${url}/admin/content/${COLLECTION}/${id}`);
			await field(page, 'Title').locator('input').fill(`${tag} v2`);
			await saveAndWait(page, new RegExp(`/items/${COLLECTION}/${id}$`), 'PATCH');

			// Revert to the first revision: sidebar, comparison of "Created", Apply, Save (US3.2).
			await page.goto(`${url}/admin/content/${COLLECTION}/${id}`);
			await openSidebar(page, 'Revisions');
			await page.locator('.revision-item', { hasText: 'Created' }).click();
			await page.getByRole('button', { name: 'Apply' }).click();
			await expect(page.locator('.comparison-modal')).toBeHidden();
			// The comparison renders the field twice more (comparison-mode=true) while it closes.
			await expect(page.locator('input[field="title"][comparison-mode="false"]')).toHaveValue(`${tag} v1`);
			await saveAndWait(page, new RegExp(`/items/${COLLECTION}/${id}$`), 'PATCH');

			// A comment from the comments sidebar (US4.4).
			await page.goto(`${url}/admin/content/${COLLECTION}/${id}`);
			await openSidebar(page, 'Comments');
			await page.locator('[placeholder="Leave a comment..."]').click();
			await page.keyboard.type(`${tag} looks good`);
			const posted = page.waitForResponse((r) => r.url().endsWith('/comments') && r.request().method() === 'POST');
			await page.getByRole('button', { name: 'Submit' }).click();
			expect((await posted).status()).toBe(200);
			await expect(page.getByText(`${tag} looks good`)).toBeVisible();

			// A version from the version menu, then an edit saved into it (US2).
			await page.locator('header').getByText('Main', { exact: true }).click();
			await page.getByText('Create Version').click();
			await page.locator('[placeholder="Version Name"]').fill(`${tag} proposal`);
			await page.locator('[placeholder="Version Key"]').fill('proposal');
			const version = page.waitForResponse((r) => r.url().endsWith('/versions') && r.request().method() === 'POST');
			await page.locator('.v-card').getByRole('button', { name: 'Save' }).click();
			expect((await version).status()).toBe(200);
			await field(page, 'Title').locator('input').fill(`${tag} draft`);
			// In a version the header saves into it with the "beenhere" button (item.vue saveVersionAction('stay')).
			const saved = page.waitForResponse(
				(r) => /\/versions\/[^/]+\/save$/.test(r.url()) && r.request().method() === 'POST',
			);
			await page
				.locator('header button')
				.filter({ has: page.locator('i[data-icon="beenhere"]') })
				.first()
				.click();
			expect((await saved).status()).toBe(200);

			// Rename, promote (Apply, then Keep the version), delete, from the version menu (US2.5, US2.6).
			const versionMenu = page.locator('.version-button').first();
			const versionCall = (method: string, path: RegExp) =>
				page.waitForResponse((r) => path.test(new URL(r.url()).pathname) && r.request().method() === method);

			await versionMenu.click();
			await page.getByText('Rename Version').click();
			await page.locator('.v-card [placeholder="Version Name"]').fill(`${tag} renamed`);
			const renamed = versionCall('PATCH', /\/versions\/[^/]+$/);
			await page.locator('.v-card').getByRole('button', { name: 'Save' }).click();
			expect((await renamed).status()).toBe(200);

			await versionMenu.click();
			await page.getByText('Promote Version').click();
			const promoted = versionCall('POST', /\/versions\/[^/]+\/promote$/);
			await page.locator('.comparison-modal').getByRole('button', { name: 'Apply' }).click();
			await page.getByRole('button', { name: 'Keep' }).click();
			expect((await promoted).status()).toBe(200);

			await page.goto(`${url}/admin/content/${COLLECTION}/${id}?version=proposal`);
			await versionMenu.click();
			await page.getByText('Delete Version').click();
			const deleted = versionCall('DELETE', /\/versions\/[^/]+$/);
			await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
			expect((await deleted).status()).toBe(204);

			// The activity module lists the writes and opens one (US1.3).
			await page.goto(`${url}/admin/activity`);
			await expect(page.locator('tbody tr').first()).toBeVisible();
		},
		[COLLECTION, 'directus_comments', 'directus_versions'],
	);

	// Each run writes its own item (serial id), so the item key, the hash of the main item taken over it and the _date
	// stamp of the version delta differ by construction; tests/parity/src/history/versions.test.ts compares the hash.
	const comparable = (value: unknown, key?: string): unknown => {
		if (key === 'item' && typeof value === 'string' && /^\d+$/.test(value)) return '<item>';
		if (key === '_date' || key === 'hash') return value == null ? null : `<${key}>`;
		if (Array.isArray(value)) return value.map((v) => comparable(v));
		if (value && typeof value === 'object')
			return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, comparable(v, k)]));
		return value;
	};

	expect(comparable(changes['prx'])).toEqual(comparable(changes['dir']));
	expect(JSON.stringify(changes['prx'])).toContain('e2e-<run> looks good');
});
