// Feature 005 (FR-046, SC-008, T046): the content module of the Directus app through the proxy, where /items goes to
// the new app, writes the same rows as Directus alone: create, edit and delete an item, delete two at once, and export
// the list as CSV (sidebar Import / Export, "Download File"); the downloaded files match once ids are labelled.
import { expect, type Page, test } from '@playwright/test';
import { deleteOpenItem, field, saveButton } from './helpers/app.js';
import { closeHostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

const COLLECTION = 'e2e_articles';

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
		meta: { icon: 'article' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string', meta: { interface: 'input' } },
			{ field: 'body', type: 'text', meta: { interface: 'input-multiline' } },
		],
	});
	expect(created.status).toBe(200);
});

test.afterAll(async () => {
	await admin('DELETE', `/collections/${COLLECTION}`);
	await closeHostDb();
});

/** Creates an item from the item page; returns its id (the app goes back to the list after saving). */
async function createItem(page: Page, url: string, title: string, body: string): Promise<number> {
	await page.goto(`${url}/admin/content/${COLLECTION}/+`);
	await field(page, 'Title').locator('input').fill(title);
	await field(page, 'Body').locator('textarea').fill(body);
	const created = page.waitForResponse(
		(r) => r.url().includes(`/items/${COLLECTION}`) && r.request().method() === 'POST',
	);
	await saveButton(page).click();
	const response = await created;
	expect(response.status()).toBe(200);
	return ((await response.json()) as any).data.id as number;
}

test('create, edit, delete, delete two at once and export CSV', async ({ browser }) => {
	const files: Record<string, string> = {};

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const id = await createItem(page, url, `${tag} one`, 'first body');

			await page.goto(`${url}/admin/content/${COLLECTION}/${id}`);
			await field(page, 'Title').locator('input').fill(`${tag} one edited`);
			const patched = page.waitForResponse(
				(r) => r.url().includes(`/items/${COLLECTION}/${id}`) && r.request().method() === 'PATCH',
			);
			await saveButton(page).click();
			expect((await patched).status()).toBe(200);

			await page.goto(`${url}/admin/content/${COLLECTION}/${id}`);
			const deleted = page.waitForResponse(
				(r) => r.url().includes(`/items/${COLLECTION}/${id}`) && r.request().method() === 'DELETE',
			);
			await deleteOpenItem(page);
			expect((await deleted).status()).toBe(204);

			const ids = [
				await createItem(page, url, `${tag} two`, 'second, "quoted"'),
				await createItem(page, url, `${tag} three`, 'third'),
			];

			// Export: sidebar Import / Export, Export Items, then the Download File action (window.open of ?export=csv).
			await page.goto(`${url}/admin/content/${COLLECTION}`);
			await page.getByRole('button', { name: /Import \/ Export/ }).click();
			await page.getByRole('button', { name: 'Export Items' }).click();
			// The app opens the export URL with window.open; the download event of that popup races the listener, so the
			// request the app makes is captured and fetched again with the session of the context.
			const exportRequest = page.context().waitForEvent('request', (r) => r.url().includes('export=csv'));
			await page
				.locator('.v-drawer')
				.last()
				.locator('button')
				.filter({ has: page.locator('i[data-icon="download"]') })
				.first()
				.click();
			const exportUrl = (await exportRequest).url();
			const file = await page.context().request.get(exportUrl);
			expect(file.status()).toBe(200);
			expect(file.headers()['content-disposition']).toMatch(new RegExp(`^attachment; filename="${COLLECTION} `));
			let text = (await file.text()).split(tag).join('e2e-<run>');
			ids.forEach((value, i) => (text = text.replace(new RegExp(`(^|\\n)${value},`), `$1<id${i + 1}>,`)));
			files[tag.slice(-3)] = text;

			// Both rows selected in the list, then deleted at once (DELETE with an array of keys).
			await page.goto(`${url}/admin/content/${COLLECTION}`);
			await expect(page.locator('tbody tr')).toHaveCount(2);
			for (const row of await page.locator('tbody tr').all()) await row.getByRole('checkbox').click();
			const batch = page.waitForResponse(
				(r) => r.url().endsWith(`/items/${COLLECTION}`) && r.request().method() === 'DELETE',
			);
			await deleteOpenItem(page);
			expect((await batch).status()).toBe(204);
		},
		[COLLECTION],
	);

	expect(files['prx']).toContain('e2e-<run> two');
	expect(files['prx']).toBe(files['dir']);
	expect(changes['prx']).toEqual(changes['dir']);
});
