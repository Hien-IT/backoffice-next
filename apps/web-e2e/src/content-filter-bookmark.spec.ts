// Feature 014 US3 (T049; US3-1 to US3-5, FR-010 to FR-017, FR-040 to FR-043): search, the advanced filter, bookmarks and
// role/global presets on the fixture set bo_* (seeded presets: admin preset and bookmark `bo-bookmark`, role preset of
// bo-editor, global preset in cards, global bookmark `bo-global-bookmark`). Bookmarks a test creates carry DATA_PREFIX;
// the admin preset of bo_content is restored after each test.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, DATA_PREFIX } from './helpers/config.js';
import { e2eName, openCollection, waitForTable } from './helpers/content.js';
import { moduleNavigation } from './helpers/layout.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

type Preset = {
	id: number;
	layout: string | null;
	layout_query: any;
	layout_options: any;
	search: string | null;
	filter: any;
};

// Test values of the fixture users, from apps/web/fixtures/interfaces/lib.mjs (USERS).
const EDITOR = { email: 'bo-editor@example.com', password: 'bo-editor-test-password' };

let api: AdminApi;
let me: string;
let seeded: Preset | undefined;

test.describe.configure({ mode: 'serial' });

async function presets(query: string): Promise<Preset[]> {
	await api.call('POST', '/utils/cache/clear');
	return api.call<Preset[]>('GET', `/presets?limit=-1&filter[collection][_eq]=bo_content&${query}`);
}

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
	seeded = (await presets(`filter[user][_eq]=${me}&filter[bookmark][_null]=true`))[0];
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
});

test.afterEach(async ({ page }) => {
	// Close the page first: its preset auto-save (450 ms debounce) must not land after the restore below.
	await page.waitForTimeout(600);
	await page.close();
	const mine = await presets(`filter[bookmark][_starts_with]=${encodeURIComponent(DATA_PREFIX)}`);
	if (mine.length) await api.call('DELETE', '/presets', { data: mine.map((p) => p.id) });

	if (seeded) {
		const { layout, layout_query, layout_options, search, filter } = seeded;
		await api.call('PATCH', `/presets/${seeded.id}`, {
			data: { layout, layout_query, layout_options, search, filter },
		});
	}

	// Presets the editor wrote over the role preset (US3-5).
	const editor = await api.call<{ id: string }[]>('GET', `/users?filter[email][_eq]=${EDITOR.email}&fields=id`);
	const editorPresets = await presets(`filter[user][_eq]=${editor[0]!.id}&filter[bookmark][_null]=true`);
	if (editorPresets.length) await api.call('DELETE', '/presets', { data: editorPresets.map((p) => p.id) });
});

async function signIn(page: Page, user = ADMIN) {
	await page.goto('/admin/login');
	await login(page, user);
	await expect(page).toHaveURL(user === ADMIN ? CONTENT_URL : /\/admin\/(?!login)/);
}

const rows = (page: Page) => page.getByRole('main').getByRole('table').locator('tbody tr');

test('search narrows the rows and is saved in the preset (US3-1, FR-040)', { tag: '@core' }, async ({ page }) => {
	await signIn(page);
	await openCollection(page, 'bo_content');
	await waitForTable(page);

	const saved = page.waitForRequest((r) => r.method() === 'PATCH' && /\/presets\/\d+$/.test(r.url()));
	await page.getByRole('searchbox', { name: 'Search Items...' }).fill('Content 02');
	await expect(rows(page)).toHaveCount(1);
	expect((await saved).postDataJSON()).toMatchObject({ search: 'Content 02' });

	await page.getByRole('button', { name: 'Clear Value' }).click();
	await expect(rows(page)).toHaveCount(20);
});

test(
	'advanced filter: a rule narrows the rows, the count badge shows it (US3-1, FR-041 to FR-043)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page);
		await openCollection(page, 'bo_content');
		await waitForTable(page);

		await page.getByRole('button', { name: 'Filter', exact: true }).click();
		await page.getByRole('button', { name: 'Add Filter' }).click();
		await page
			.getByRole('treeitem', { name: /^Title/ })
			.first()
			.click();
		const saved = page.waitForRequest(
			(r) => r.method() === 'PATCH' && /\/presets\/\d+$/.test(r.url()) && !!r.postDataJSON()?.filter,
		);
		await page.getByRole('dialog').getByRole('textbox').last().fill('Content 0');
		const filter = (await saved).postDataJSON().filter;
		expect(JSON.stringify(filter)).toContain('Content 0');
		await expect(rows(page)).not.toHaveCount(20);

		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Filter', exact: true })).toContainText('1');
	},
);

test(
	'create a bookmark, open it from the tree, update and reset it (US3-2, US3-3, FR-012 to FR-015)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page);
		await openCollection(page, 'bo_content');
		await waitForTable(page);

		await page.getByRole('button', { name: 'Create Bookmark' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('textbox').first().fill(e2eName('bookmark'));
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(page).toHaveURL(/\/admin\/content\/bo_content\?bookmark=\d+$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(e2eName('bookmark'));

		// Saved: no update button; a sort change makes it unsaved (update + reset), reset brings it back.
		await expect(page.getByRole('button', { name: 'Update Bookmark' })).toHaveCount(0);
		await page.getByRole('main').getByRole('table').getByRole('button', { name: 'Title', exact: true }).click();
		await page.getByRole('menuitemradio', { name: 'Sort Descending' }).click();
		await expect(page.getByRole('button', { name: 'Update Bookmark' })).toBeVisible();
		await page.getByRole('button', { name: 'Reset Bookmark' }).click();
		await expect(page.getByRole('button', { name: 'Update Bookmark' })).toHaveCount(0);

		// A reload reads /presets again: the parity APIs cache it (CACHE_ENABLED).
		await api.call('POST', '/utils/cache/clear');
		await page.goto('/admin/content/bo_std');
		await moduleNavigation(page);
		await page
			.getByRole('tree', { name: 'Collections' })
			.getByRole('link', { name: e2eName('bookmark') })
			.click();
		await expect(page).toHaveURL(/\?bookmark=\d+$/);
	},
);

test('rename and delete a personal bookmark from the tree (US3-4, FR-017)', { tag: '@core' }, async ({ page }) => {
	const created = await api.call<{ id: number }>('POST', '/presets', {
		data: { collection: 'bo_content', user: me, bookmark: e2eName('tree'), layout: 'tabular' },
	});
	await signIn(page);
	await page.goto(`/admin/content/bo_content?bookmark=${created.id}`);
	await waitForTable(page);
	await moduleNavigation(page);
	const tree = page.getByRole('tree', { name: 'Collections' });

	await tree.getByRole('button', { name: `Options for ${e2eName('tree')}` }).click();
	await page.getByRole('menuitem', { name: 'Edit Personal Bookmark' }).click();
	const edit = page.getByRole('dialog');
	await edit.getByRole('textbox').first().fill(e2eName('renamed'));
	await edit.getByRole('button', { name: 'Save' }).click();
	await expect(tree.getByRole('link', { name: e2eName('renamed') })).toBeVisible();

	await tree.getByRole('button', { name: `Options for ${e2eName('renamed')}` }).click();
	await page.getByRole('menuitem', { name: 'Delete Personal Bookmark' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);
	await expect(tree.getByRole('link', { name: e2eName('renamed') })).toHaveCount(0);
	await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test(
	'a global bookmark only offers "create bookmark"; an unknown bookmark shows the notice (FR-015, FR-016)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page);
		const global = (await presets('filter[bookmark][_eq]=bo-global-bookmark'))[0]!;

		await page.goto(`/admin/content/bo_content?bookmark=${global.id}`);
		await waitForTable(page);
		await page.getByRole('main').getByRole('table').getByRole('button', { name: 'Title', exact: true }).click();
		await page.getByRole('menuitemradio', { name: 'Sort Descending' }).click();
		await expect(page.getByRole('button', { name: 'Create Bookmark' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Update Bookmark' })).toHaveCount(0);

		await page.goto('/admin/content/bo_content?bookmark=999999');
		await expect(page.getByRole('heading', { name: "Bookmark Doesn't Exist" })).toBeVisible();
		await page.getByRole('link', { name: 'Return to collection' }).click();
		await expect(page).toHaveURL(/\/admin\/content\/bo_content$/);
	},
);

test(
	'the role preset of bo-editor; a change writes a preset of the user (US3-5, FR-018)',
	{ tag: '@core' },
	async ({ page }) => {
		await signIn(page, EDITOR);
		await openCollection(page, 'bo_content');
		const table = await waitForTable(page);

		// Role preset: title and status (no date column).
		await expect(table.getByRole('button', { name: 'Status', exact: true })).toBeVisible();
		await expect(table.getByRole('button', { name: 'Date Published', exact: true })).toHaveCount(0);
		const written = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/presets'));
		await table.getByRole('button', { name: 'Title', exact: true }).click();
		await page.getByRole('menuitemradio', { name: 'Sort Ascending' }).click();
		const body = (await written).postDataJSON();
		expect(body.user).toBeTruthy();
		// Like Directus (store savePreset): the role preset is copied whole, with the user set.
		expect(body.role).toBeTruthy();
		expect(body.layout_query.tabular.fields).toEqual(['title', 'status']);
	},
);
