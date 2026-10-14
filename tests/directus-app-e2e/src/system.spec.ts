// Feature 010 (spec FR-103, contracts/parity.md §7): the screens of the Directus app that read and write the system
// collections of this feature, through the proxy where /settings, /presets, /notifications, /shares, /translations,
// /dashboards, /panels, /utils and /extensions go to the new app, write the same rows as Directus alone.
import { expect, type Page, type Response, test } from '@playwright/test';
import { deleteOpenItem, field, pickInDrawer, save, saveButton } from './helpers/app.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { ADMIN } from './helpers/login.js';
import { bothRuns, DIRECTUS_URL } from './helpers/scenario.js';

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

/** A request as the admin at `url` (the proxy or Directus alone), like admin() but for the app of a run. */
async function adminAt(url: string, method: string, path: string, body?: unknown) {
	const login = await fetch(`${url}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;

	return fetch(`${url}${path}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

const call = (page: Page, method: string, path: RegExp) =>
	page.waitForResponse((r) => path.test(new URL(r.url()).pathname) && r.request().method() === method);

const ARTICLES = 'e2e_system_articles';

test.beforeAll(async () => {
	await hostDb()('directus_presets').where({ collection: ARTICLES }).delete();
	await admin('DELETE', `/collections/${ARTICLES}`);
	const created = await admin('POST', '/collections', {
		collection: ARTICLES,
		schema: {},
		meta: { icon: 'article', sort_field: 'sort' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'sort', type: 'integer', meta: { interface: 'input', hidden: true } },
			{ field: 'title', type: 'string', meta: { interface: 'input' } },
		],
	});
	expect(created.status).toBe(200);
	await admin('POST', `/items/${ARTICLES}`, [
		{ title: 'one', sort: 1 },
		{ title: 'two', sort: 2 },
		{ title: 'three', sort: 3 },
	]);
});

test.afterAll(async () => {
	await hostDb()('directus_presets').where({ collection: ARTICLES }).delete();
	await hostDb()('directus_shares').where({ collection: ARTICLES }).delete();
	await admin('DELETE', `/collections/${ARTICLES}`);
	await closeHostDb();
});

test('Settings: project name, then color, default appearance and custom CSS', async ({ browser }) => {
	const fields = ['project_name', 'project_color', 'default_appearance', 'custom_css'];
	const before = await hostDb()('directus_settings').select(fields).first();

	try {
		const changes = await bothRuns(
			browser,
			async (page, url, tag) => {
				await page.goto(`${url}/admin/settings/project`);
				await field(page, 'Project Name').getByRole('textbox').fill(tag);
				const patched = call(page, 'PATCH', /^\/settings$/);
				await save(page);
				expect((await patched).status()).toBe(200);

				await page.goto(`${url}/admin/settings/appearance`);
				await field(page, 'Project Color').getByRole('textbox').fill('#123456');
				await field(page, 'Default Appearance').locator('.v-input').click();
				await page.getByRole('button', { name: 'Dark', exact: true }).click();
				// A code editor: fill() appends to the CSS the other run left, so select all and type over it.
				await field(page, 'Custom CSS').locator('.CodeMirror').click();
				await page.keyboard.press('ControlOrMeta+a');
				await page.keyboard.type(`/* ${tag} */`);
				await save(page);

				await page.reload();
				await expect(page).toHaveTitle(new RegExp(tag));
			},
			['directus_settings'],
		);

		expect(changes['prx']).toEqual(changes['dir']);
		expect((changes['dir'] as any).directus_settings.changed[0]).toMatchObject({
			project_name: 'e2e-<run>',
			project_color: '#123456',
			default_appearance: 'dark',
			custom_css: '/* e2e-<run> */',
		});
	} finally {
		await admin('PATCH', '/settings', before);
	}
});

test('Settings > Translations: create, edit, a duplicate key and language is refused, delete', async ({ browser }) => {
	const language = async (page: Page, name: string) => {
		await field(page, 'Language').locator('.v-input').click();
		await page.getByRole('button', { name, exact: true }).click();
	};

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const key = `${tag}_greeting`;

			await page.goto(`${url}/admin/settings/translations/+`);
			await field(page, 'Key').getByRole('textbox').fill(key);
			await language(page, 'English (United States)');
			await field(page, 'Value').getByRole('textbox').fill('Hello');
			const created = call(page, 'POST', /^\/translations$/);
			await save(page);
			expect((await created).status()).toBe(200);

			await page.getByText(key).first().click();
			await field(page, 'Value').getByRole('textbox').fill('Hi');
			const updated = call(page, 'PATCH', /^\/translations\/[0-9a-f-]+$/);
			await save(page);
			expect((await updated).status()).toBe(200);

			await page.goto(`${url}/admin/settings/translations/+`);
			await field(page, 'Key').getByRole('textbox').fill(key);
			await language(page, 'English (United States)');
			await field(page, 'Value').getByRole('textbox').fill('Again');
			const duplicate = call(page, 'POST', /^\/translations$/);
			await saveButton(page).click();
			expect((await duplicate).status()).toBe(400);
			await expect(page.getByText('Duplicate key and language combination').first()).toBeVisible();

			await page.goto(`${url}/admin/settings/translations`);
			await page.getByText(key).first().click();
			const deleted = call(page, 'DELETE', /^\/translations\/[0-9a-f-]+$/);
			await deleteOpenItem(page);
			expect((await deleted).status()).toBe(204);
		},
		['directus_translations'],
	);

	expect(changes['prx']).toEqual(changes['dir']);
	const translations = (changes['dir'] as any).activity.filter((a: any) => a.collection === 'directus_translations');
	expect(translations.map((a: any) => a.action)).toEqual(['create', 'update', 'delete']);
});

test('Insights: create a dashboard, add a Label panel, edit it, delete the panel, delete the dashboard', async ({
	browser,
}) => {
	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const board = `${tag} board`;
			const header = page.locator('header').first();

			await page.goto(`${url}/admin/insights`);
			await header.getByRole('button', { name: 'add' }).click();
			await page.getByRole('textbox', { name: 'Dashboard Name' }).last().fill(board);
			const created = call(page, 'POST', /^\/dashboards$/);
			await page.getByRole('button', { name: 'Save' }).last().click();
			expect((await created).status()).toBe(200);
			await expect(page).toHaveURL(/\/admin\/insights\/[0-9a-f-]+$/);

			// Add a Label panel in edit mode, then save the dashboard (POST /panels with the new panel).
			await header.getByRole('button', { name: 'edit' }).click();
			await header.getByRole('link', { name: 'add' }).click();
			const drawer = page.locator('.v-drawer').last();
			await drawer.getByRole('button', { name: 'Label' }).click();
			await field(page, 'Label').getByRole('textbox').first().fill(`${tag} label`);
			await drawer.getByRole('button', { name: 'check' }).click();
			await expect(drawer).toBeHidden();
			const panels = call(page, 'POST', /^\/panels$/);
			await header.getByRole('button', { name: 'check' }).click();
			expect((await panels).status()).toBe(200);

			// Edit the panel from its tile (PATCH /panels with the batch of updates). Dragging the tile with page.mouse is
			// not picked up by the throttled pointer handlers of v-workspace-tile, so the position is not changed here.
			await header.getByRole('button', { name: 'edit' }).click();
			const tile = page.locator('.v-workspace-tile').first();
			await tile.hover();
			await tile.locator('.edit-icon').click();
			await field(page, 'Label').getByRole('textbox').first().fill(`${tag} label 2`);
			await page.locator('.v-drawer').last().getByRole('button', { name: 'check' }).click();
			const updated = call(page, 'PATCH', /^\/panels$/);
			await header.getByRole('button', { name: 'check' }).click();
			expect((await updated).status()).toBe(200);

			// Delete the panel from its menu (DELETE /panels).
			await header.getByRole('button', { name: 'edit' }).click();
			await tile.hover();
			await tile.locator('.more-icon').click();
			await page.locator('.delete-action').click();
			const removed = call(page, 'DELETE', /^\/panels$/);
			await header.getByRole('button', { name: 'check' }).click();
			expect((await removed).status()).toBe(204);

			// Delete the dashboard from the row menu of the overview.
			await page.goto(`${url}/admin/insights`);
			await page.locator('tr', { hasText: board }).locator('.ctx-toggle').click();
			await page.getByText('Delete Dashboard').click();
			const deleted = call(page, 'DELETE', /^\/dashboards\/[0-9a-f-]+$/);
			await page.locator('.v-card').getByRole('button', { name: 'Delete' }).click();
			expect((await deleted).status()).toBe(204);
		},
		['directus_dashboards', 'directus_panels'],
	);

	expect(changes['prx']).toEqual(changes['dir']);
	const actions = (changes['dir'] as any).activity
		.filter((a: any) => a.collection !== 'directus_users')
		.map((a: any) => `${a.action} ${a.collection}`);
	expect(actions).toEqual([
		'create directus_dashboards',
		'create directus_panels',
		'update directus_panels',
		'delete directus_panels',
		'delete directus_dashboards',
	]);
});

test('Settings > Marketplace: the fake registry list, an extension, Install is refused (D-37)', async ({ browser }) => {
	const EXTENSION = 'e0000000-0000-4000-8000-000000000001'; // tests/parity/registry/fixtures
	const reasons: Record<string, string> = {};
	// Directus writes the directus_extensions row before it downloads (ExtensionsService.install), so a failed
	// download leaves it: remove it before and after.
	const clear = () => hostDb()('directus_extensions').where({ id: EXTENSION }).delete();
	await clear();

	try {
		const changes = await bothRuns(
			browser,
			async (page, url, tag) => {
				await page.goto(`${url}/admin/settings/marketplace`);
				await page.getByText('Parity Interface Color').click();
				await expect(page.getByRole('heading', { name: 'Parity Interface Color' })).toBeVisible();

				const install = call(page, 'POST', /^\/extensions\/registry\/install$/);
				await page.getByRole('button', { name: 'Install Extension' }).click();
				const res = await install;
				expect(res.status()).toBe(503);
				reasons[tag.slice(-3)] = ((await res.json()) as any).errors[0].extensions.reason;
				await expect(page.locator('.v-notification, .v-dialog').first()).toBeVisible();
			},
			['directus_extensions'],
		);

		const [prx, dir] = [changes['prx'] as any, changes['dir'] as any];
		const installed = (a: any) => a.collection === 'directus_extensions';

		// D-37: the new app refuses before writing; Directus writes the row, then cannot download from the fake registry.
		expect(reasons).toEqual({
			prx: 'Backoffice does not install extensions',
			dir: 'Could not download the extension',
		});
		expect(prx.directus_extensions).toEqual({ added: [], changed: [], removed: [] });
		expect(prx.activity.filter(installed)).toEqual([]);
		expect(dir.directus_extensions.added).toEqual([
			{ id: expect.any(String), enabled: true, folder: expect.any(String), source: 'registry', bundle: null },
		]);
		expect(dir.activity.filter(installed)).toEqual([
			{ action: 'create', collection: 'directus_extensions', item: '<serial>' },
		]);
	} finally {
		await clear();
	}
});

test('Notifications: one for the admin through the API, the bell drawer lists it, archive it', async ({ browser }) => {
	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const me = ((await (await adminAt(url, 'GET', '/users/me?fields=id')).json()) as any).data.id;
			const sent = await adminAt(url, 'POST', '/notifications', { recipient: me, subject: `${tag} hello` });
			expect(sent.status).toBe(200);

			await page.reload();
			await page.getByRole('button', { name: 'notifications' }).click();
			const drawer = page.locator('.v-drawer').last();
			await drawer.getByRole('button', { name: 'search', exact: true }).click();
			await drawer.getByRole('searchbox').fill(tag);
			// The search marks the matching text, so the row is found by its text, not its accessible name.
			const row = drawer.getByRole('listitem').filter({ hasText: tag });
			await expect(row).toBeVisible();

			await row.getByRole('checkbox').click();
			const archived = call(page, 'PATCH', /^\/notifications$/);
			await drawer.getByRole('button', { name: 'archive', exact: true }).click();
			expect((await archived).status()).toBe(200);
			await expect(row).toBeHidden();

			await drawer.getByRole('button', { name: 'archive Archive' }).click();
			await expect(drawer.getByRole('listitem').filter({ hasText: tag })).toBeVisible();
		},
		['directus_notifications'],
	);

	expect(changes['prx']).toEqual(changes['dir']);
	expect((changes['dir'] as any).directus_notifications.added).toEqual([
		expect.objectContaining({ subject: 'e2e-<run> hello', status: 'archived' }),
	]);
});

test('Content: the search saved in the preset of a collection, a personal bookmark created, renamed, deleted', async ({
	browser,
}) => {
	const presets: Record<string, unknown> = {};

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const nav = page.getByRole('navigation', { name: 'Module Navigation' });
			await page.goto(`${url}/admin/content/${ARTICLES}`);

			// A search is saved in the user preset of the collection.
			const saved = call(page, 'POST', /^\/presets$/);
			await page.locator('header').getByRole('button', { name: 'search', exact: true }).click();
			await page.locator('header').getByRole('searchbox').fill('t');
			expect((await saved).status()).toBe(200);

			// The bookmark of the current view.
			await page.locator('header').getByRole('button', { name: 'bookmark' }).click();
			await page.locator('.v-card').last().getByRole('textbox').first().fill(`${tag} bm`);
			const bookmarked = call(page, 'POST', /^\/presets$/);
			await page.locator('.v-card').last().getByRole('button', { name: 'Save' }).click();
			expect((await bookmarked).status()).toBe(200);
			const link = nav.getByRole('link', { name: new RegExp(`${tag} bm`) });
			await expect(link).toBeVisible();

			await link.getByRole('button', { name: 'more_vert' }).click();
			await page.getByText('Edit Personal Bookmark').click();
			await page.locator('.v-card').last().getByRole('textbox').first().fill(`${tag} renamed`);
			const renamed = call(page, 'PATCH', /^\/presets\/\d+$/);
			await page.locator('.v-card').last().getByRole('button', { name: 'Save' }).click();
			expect((await renamed).status()).toBe(200);

			const renamedLink = nav.getByRole('link', { name: new RegExp(`${tag} renamed`) });
			await renamedLink.getByRole('button', { name: 'more_vert' }).click();
			await page.getByText('Delete Personal Bookmark').click();
			const deleted = call(page, 'DELETE', /^\/presets$/);
			await page.locator('.v-card').last().getByRole('button', { name: 'Delete' }).click();
			expect((await deleted).status()).toBe(204);
			await expect(renamedLink).toBeHidden();

			// The preset rows the run left, then removed so the other run starts from none.
			const rows = await hostDb()('directus_presets')
				.select('bookmark', 'collection', 'layout', 'layout_query', 'search', 'filter', 'role', 'icon', 'color')
				.where({ collection: ARTICLES });
			presets[tag.slice(-3)] = rows;
			await hostDb()('directus_presets').where({ collection: ARTICLES }).delete();
		},
		['directus_presets'],
	);

	// last_page of the admin names the bookmark by its serial id.
	const serial = (value: unknown) => JSON.parse(JSON.stringify(value).replace(/bookmark=\d+/g, 'bookmark=<id>'));
	expect(serial(changes['prx'])).toEqual(serial(changes['dir']));
	expect(presets['prx']).toEqual(presets['dir']);
	expect(presets['dir']).toEqual([expect.objectContaining({ bookmark: null, search: 't' })]);
	// directus_presets has no accountability in the system data: no activity at either app.
	expect((changes['dir'] as any).activity.filter((a: any) => a.collection === 'directus_presets')).toEqual([]);
});

test('Content: manual sort, a row dragged by its handle, the order kept after a reload', async ({ browser }) => {
	const orders: Record<string, string[]> = {};
	const titles = async (page: Page) => page.locator('tbody tr td:nth-child(3)').allInnerTexts();

	const changes = await bothRuns(browser, async (page, url, tag) => {
		await page.goto(`${url}/admin/content/${ARTICLES}`);
		await expect.poll(() => titles(page)).toEqual(['one', 'two', 'three']);

		// v-table runs Sortable in fallback mode (pointer events): press the handle of "one" and move slowly down
		// past the middle of "three", so Sortable moves "one" after it. A drag that Sortable did not pick up sends no
		// request (seen once on CI): wait 5 s for it, then drag again.
		await page.waitForLoadState('networkidle');
		const drag = async () => {
			const from = (await page.locator('tbody tr', { hasText: 'one' }).locator('.drag-handle').boundingBox())!;
			const to = (await page.locator('tbody tr', { hasText: 'three' }).boundingBox())!;
			const [x, y] = [from.x + from.width / 2, from.y + from.height / 2];
			await page.mouse.move(x, y);
			await page.mouse.down();
			for (let step = 1; step <= 20; step++) {
				await page.mouse.move(x, y + ((to.y + to.height * 0.8 - y) * step) / 20);
				await page.waitForTimeout(30);
			}
			await page.waitForTimeout(200);
			await page.mouse.up();
		};

		let res: Response | undefined;
		for (let attempt = 0; attempt < 3 && !res; attempt++) {
			const sorted = page
				.waitForResponse((r) => r.url().includes(`/utils/sort/${ARTICLES}`) && r.request().method() === 'POST', {
					timeout: 5_000,
				})
				.catch(() => undefined);
			await drag();
			res = await sorted;
		}
		if (!res) throw new Error('the drag never sent POST /utils/sort');
		expect(res.status()).toBe(200);
		expect(res.request().postDataJSON()).toEqual({ item: expect.any(Number), to: expect.any(Number) });

		await page.reload();
		await expect.poll(async () => (await titles(page)).length).toBe(3);
		orders[tag.slice(-3)] = await titles(page);

		// Back to one, two, three for the other run (R-26: the sort writes no activity).
		for (const [i, title] of ['one', 'two', 'three'].entries())
			await hostDb()(ARTICLES)
				.where({ title })
				.update({ sort: i + 1 });
	});

	expect(changes['prx']).toEqual(changes['dir']);
	expect(orders['prx']).toEqual(orders['dir']);
	expect(orders['dir']).toEqual(['two', 'three', 'one']);
});

test('Shares: an item shared with a role, a password and max uses; the link opened signed out, a wrong then the right password', async ({
	browser,
}) => {
	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			const item = (await hostDb()(ARTICLES).where({ title: 'one' }).first()).id;
			await page.goto(`${url}/admin/content/${ARTICLES}/${item}`);
			await page.getByRole('button', { name: 'share Shares chevron_left' }).click();
			await page.getByRole('button', { name: 'New Share' }).click();

			await field(page, 'Name').getByRole('textbox').fill(`${tag} share`);
			await field(page, 'Role').getByText('Select an item...').click();
			await pickInDrawer(page, 'Administrator');
			await field(page, 'Password').getByRole('textbox').fill('pw');
			await field(page, 'Max Uses').getByRole('spinbutton').fill('5');
			const created = call(page, 'POST', /^\/shares$/);
			await page.locator('.v-drawer').last().getByRole('button', { name: 'check' }).click();
			const res = await created;
			expect(res.status()).toBe(200);
			const share =
				((await res.json()) as any).data?.id ??
				(
					await hostDb()('directus_shares')
						.where({ name: `${tag} share` })
						.first()
				).id;
			await expect(page.getByText(`${tag} share`)).toBeVisible();

			// The link in a signed out browser: a wrong password, then the right one shows the item.
			const visitor = await browser.newContext();
			const shared = await visitor.newPage();

			try {
				const passcode = shared.getByRole('textbox', { name: 'Enter your passcode to continue...' });
				await shared.goto(`${url}/admin/shared/${share}`);
				await passcode.fill('bad');
				await shared.getByRole('button', { name: 'Access Shared Page' }).click();
				await expect(shared.getByRole('status')).toContainText('INVALID_CREDENTIALS');

				await shared.reload();
				await passcode.fill('pw');
				await shared.getByRole('button', { name: 'Access Shared Page' }).click();
				await expect(shared.getByRole('heading', { name: 'Viewing Item in E2e System Articles' })).toBeVisible();
				await expect(field(shared, 'Title').getByRole('textbox')).toHaveValue('one');
			} finally {
				await visitor.close();
			}
		},
		['directus_shares'],
	);

	expect(changes['prx']).toEqual(changes['dir']);
	expect((changes['dir'] as any).directus_shares.added).toEqual([
		expect.objectContaining({ name: 'e2e-<run> share', password: '<argon2>', max_uses: 5, times_used: 1 }),
	]);
});

test('Content: Import / Export sidebar, a CSV export to the File Library, then a CSV import of three rows', async ({
	browser,
}) => {
	const imported: Record<string, string[]> = {};
	const exports = () =>
		hostDb()('directus_files').where('filename_download', 'like', `export-${ARTICLES}-%`).count({ n: '*' }).first();

	const changes = await bothRuns(
		browser,
		async (page, url, tag) => {
			await page.goto(`${url}/admin/content/${ARTICLES}`);
			await page.getByRole('button', { name: 'import_export Import / Export chevron_left' }).click();

			// Export: the File Library as location starts POST /utils/export, the file and a notification follow.
			const before = Number((await exports())!['n']);
			await page.getByRole('button', { name: 'Export Items' }).click();
			const drawer = page.locator('.v-drawer').last();
			await drawer.locator('.v-input', { has: page.locator('input[value="Download File"]') }).click();
			await page.getByRole('button', { name: 'File Library', exact: true }).click();
			const exported = call(page, 'POST', new RegExp(`^/utils/export/${ARTICLES}$`));
			await drawer.getByRole('button', { name: 'start', exact: true }).click();
			expect((await exported).status()).toBe(204);
			await expect.poll(async () => Number((await exports())!['n']), { timeout: 30_000 }).toBe(before + 1);

			// Import: three rows from a CSV file.
			await page
				.getByRole('contentinfo', { name: 'Module Sidebar' })
				.locator('input[type="file"]')
				.setInputFiles({
					name: 'rows.csv',
					mimeType: 'text/csv',
					buffer: Buffer.from(`title\n${tag}-a\n${tag}-b\n${tag}-c\n`),
				});
			const importing = call(page, 'POST', new RegExp(`^/utils/import/${ARTICLES}$`));
			await page.getByRole('button', { name: 'Start Import' }).click();
			expect((await importing).status()).toBe(200);
			await expect(page.getByText(`${tag}-c`)).toBeVisible();

			// The imported rows, then removed so the export of the other run reads the same three rows.
			const rows = hostDb()(ARTICLES).where('title', 'like', `${tag}-%`);
			imported[tag.slice(-3)] = (await rows.clone().select('title').orderBy('id')).map((row) =>
				row.title.replace(tag, 'e2e-<run>'),
			);
			await rows.clone().delete();
		},
		['directus_files', 'directus_notifications'],
	);

	// The export file is named after the time of the export, and stored under a new name. The link to the file first: a
	// uuid whose first group is eight digits would otherwise lose it to the time pattern.
	const normalized = (value: unknown) =>
		JSON.parse(
			JSON.stringify(value)
				.replace(/admin\/files\/[0-9a-f-]{36}/g, 'admin/files/<file>')
				.replace(/\d{8}-\d{3,6}/g, '<time>')
				.replace(/"filename_disk":"[^"]+"/g, '"filename_disk":"<disk>"'),
		);
	expect(normalized(changes['prx'])).toEqual(normalized(changes['dir']));
	const dir = normalized(changes['dir']);
	expect(imported['prx']).toEqual(imported['dir']);
	expect(imported['dir']).toEqual(['e2e-<run>-a', 'e2e-<run>-b', 'e2e-<run>-c']);
	expect(dir.directus_files.added).toEqual([
		expect.objectContaining({ filename_download: `export-${ARTICLES}-<time>.csv`, type: 'text/csv' }),
	]);
});
