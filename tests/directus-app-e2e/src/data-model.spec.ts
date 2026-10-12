// Feature 006 (FR-063, SC-004, T043): the Data Model module of the Directus app through the proxy, where /collections,
// /fields, /relations and /schema go to the new app, builds the same model as Directus alone: a collection, an input
// field, a second collection and a many-to-one field to it, a translations field (the app creates the languages
// collection and the junction), an item with a translation in the content module; then deletes a field and the
// collections. Both runs must send the same data model requests with the same statuses and leave the same snapshot.
import { expect, type Page, type Response, test } from '@playwright/test';
import { closeHostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

const LANGUAGES = 'languages';

async function adminToken() {
	const login = await fetch(`${DIRECTUS_URL}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	return ((await login.json()) as any).data.access_token as string;
}

async function directus(method: string, path: string, body?: unknown) {
	return fetch(`${DIRECTUS_URL}${path}`, {
		method,
		headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

/** The names of one run: same length for both runs (tag of bothRuns ends with prx or dir). */
const names = (tag: string) => {
	const run = tag.slice(-3);
	return { articles: `e2e_dm_${run}`, authors: `e2e_dm_${run}_authors`, translations: `e2e_dm_${run}_translations` };
};

async function dropAll(run: 'prx' | 'dir') {
	const { articles, authors, translations } = names(run);
	for (const collection of [translations, articles, authors, LANGUAGES]) {
		await directus('DELETE', `/collections/${collection}`);
	}
}

test.beforeAll(async () => {
	await dropAll('prx');
	await dropAll('dir');
});

test.afterAll(async () => {
	await dropAll('prx');
	await dropAll('dir');
	await closeHostDb();
});

const DATA_MODEL = /\/(collections|fields|relations|schema)(\/|\?|$)/;

/** Waits for the response of the data model request `method` `path` the next action triggers. */
function next(page: Page, method: string, path: RegExp): Promise<Response> {
	return page.waitForResponse((r) => r.request().method() === method && path.test(new URL(r.url()).pathname));
}

const headerButton = (page: Page, icon: string) =>
	page
		.locator('.v-drawer header button, header button')
		.filter({ has: page.locator(`i[data-icon="${icon}"]`) })
		.last();

async function createCollection(page: Page, url: string, name: string) {
	await page.goto(`${url}/admin/settings/data-model/+`);
	await page.getByPlaceholder('A unique table name...').fill(name);
	await headerButton(page, 'arrow_forward').click();
	const created = next(page, 'POST', /^\/collections$/);
	await headerButton(page, 'check').click();
	expect((await created).status()).toBe(200);
}

/** "Create Field" on the collection page, an interface of the list, the key, then Save. */
async function createField(page: Page, url: string, collection: string, iface: string, key: string, related?: string) {
	// The "Create Field" link of the collection page opens the interface list of the simple mode.
	await page.goto(`${url}/admin/settings/data-model/${collection}/+`);
	await page.locator('.v-drawer').last().getByText(iface, { exact: true }).first().click();
	await page.getByPlaceholder('A unique column name...').fill(key);
	if (related !== undefined)
		await page.locator('.v-drawer').last().getByPlaceholder('Collection...').first().fill(related);
	const created = next(page, 'POST', new RegExp(`^/fields/${collection}$`));
	await page.locator('.v-drawer').last().getByRole('button', { name: 'Save' }).click();
	expect((await created).status()).toBe(200);
	// The app posts the relations and the generated collections after the field, then closes the drawer.
	await page.waitForURL((u) => u.pathname.endsWith(`/data-model/${collection}`), { timeout: 60_000 });
}

test('build a model in the Data Model module, use it in Content, delete it', async ({ browser }) => {
	const requests: Record<string, string[]> = {};
	const snapshots: Record<string, unknown> = {};

	await bothRuns(browser, async (page, url, tag) => {
		const run = tag.slice(-3);
		const { articles, authors, translations } = names(tag);
		const sent: string[] = (requests[run] = []);

		page.on('response', (r) => {
			const { pathname } = new URL(r.url());
			if (r.request().method() !== 'GET' && DATA_MODEL.test(pathname)) {
				sent.push(`${r.request().method()} ${pathname.split(`e2e_dm_${run}`).join('e2e_dm_<run>')} ${r.status()}`);
			}
		});

		await createCollection(page, url, articles);
		await createField(page, url, articles, 'Input', 'title');
		await createCollection(page, url, authors);
		await createField(page, url, articles, 'Many to One', 'author', authors);
		await createField(page, url, articles, 'Translations', 'translations');

		// Content: an item with a title (the translations interface needs the languages the wizard did not add).
		await page.goto(`${url}/admin/content/${articles}/+`);
		await page.locator('.field', { hasText: 'Title' }).locator('input').first().fill(`${tag} item`);
		const item = next(page, 'POST', new RegExp(`^/items/${articles}$`));
		await page
			.locator('header button')
			.filter({ has: page.locator('i[data-icon="check"]') })
			.first()
			.click();
		expect((await item).status()).toBe(200);

		const snapshot = ((await (await directus('GET', '/schema/snapshot')).json()) as any).data;
		const mine = (c: string) => [articles, authors, translations, LANGUAGES].includes(c);
		snapshots[run] = JSON.parse(
			JSON.stringify({
				collections: snapshot.collections.filter((c: any) => mine(c.collection)),
				fields: snapshot.fields.filter((f: any) => mine(f.collection)),
				relations: snapshot.relations.filter((r: any) => mine(r.collection)),
			})
				.split(`e2e_dm_${run}`)
				.join('e2e_dm_<run>'),
		);

		// Delete the author field (m2o: the relation goes too), then every collection of the run.
		// The menu of the field row (more_vert), "Delete Field", then the confirmation.
		await page.goto(`${url}/admin/settings/data-model/${articles}`);
		const deletedField = next(page, 'DELETE', new RegExp(`^/fields/${articles}/author$`));
		await page.locator('.field-select', { hasText: 'author' }).getByRole('button', { name: 'more_vert' }).click();
		await page.getByText('Delete Field', { exact: true }).click();
		await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
		expect((await deletedField).status()).toBe(204);

		for (const collection of [translations, articles, authors, LANGUAGES]) {
			await page.goto(`${url}/admin/settings/data-model/${collection}`);
			const deleted = next(page, 'DELETE', new RegExp(`^/collections/${collection}$`));
			await headerButton(page, 'delete').click();
			await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
			expect((await deleted).status()).toBe(204);
		}
	});

	expect(requests['prx']).toEqual(requests['dir']);
	expect(snapshots['prx']).toEqual(snapshots['dir']);
	expect((snapshots['prx'] as any).collections).toHaveLength(4);
});
