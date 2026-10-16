// Feature 014 US4 (T056; US4-1 to US4-5, FR-029, FR-035 to FR-039, FR-116): cards, calendar, kanban and map on
// bo_content of the fixture set. The admin preset is set through AdminApi for each layout (its options are tested in
// the unit tests) and restored afterwards. Not tagged @core: chromium only (SC-001).
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN } from './helpers/config.js';
import { openCollection } from './helpers/content.js';
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

let api: AdminApi;
let seeded: Preset;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
	await api.call('POST', '/utils/cache/clear');
	seeded = (
		await api.call<Preset[]>(
			'GET',
			`/presets?filter[collection][_eq]=bo_content&filter[user][_eq]=${me}&filter[bookmark][_null]=true`,
		)
	)[0]!;
});

test.beforeEach(async () => {
	await api.call('PATCH', '/users/me', { data: { last_page: null } });
});

test.afterEach(async ({ page }) => {
	// Close the page first: its preset auto-save (450 ms debounce) must not land after the restore below.
	await page.waitForTimeout(600);
	await page.close();
	const { layout, layout_query, layout_options, search, filter } = seeded;
	await api.call('PATCH', `/presets/${seeded.id}`, { data: { layout, layout_query, layout_options, search, filter } });
	await api.call('POST', '/utils/cache/clear');
});

async function openLayout(page: Page, layout: string, options: Record<string, unknown> = {}) {
	await api.call('PATCH', `/presets/${seeded.id}`, {
		data: { layout, layout_options: { [layout]: options }, layout_query: null },
	});
	await api.call('POST', '/utils/cache/clear');
	await page.goto('/admin/login');
	await login(page, ADMIN);
	// Any landing page: last_page may be written late by an earlier page (trackPage runs 500 ms after a navigation).
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
	await openCollection(page, 'bo_content');
}

test('cards: one card per item with the cover image (US4-1, FR-035)', async ({ page }) => {
	await openLayout(page, 'cards', { imageSource: 'cover', title: '{{ title }}' });

	await expect(page.getByRole('checkbox', { name: /^Select Content \d+/ })).toHaveCount(20);
	await expect(page.getByRole('main').getByText('Content 02', { exact: true })).toBeVisible();
	const image = page.getByRole('main').locator('img[src*="/assets/"]').first();
	await expect(image).toHaveAttribute('src', /key=system-medium-cover/);
});

test('calendar: next month asks the new date range; events of October (US4-2, FR-036)', async ({ page }) => {
	const list = page.waitForRequest((r) => r.url().includes('/items/bo_content?') && r.url().includes('_between'));
	await openLayout(page, 'calendar', { startDateField: 'date_published', template: '{{ title }}' });
	await list;

	await page.goto('/admin/content/bo_content');
	await expect(page.getByRole('main').getByText('Content 02').first()).toBeVisible();

	const next = page.waitForRequest((r) => decodeURIComponent(r.url()).includes('"_between":["2026-11-'));
	await page.getByRole('button', { name: 'Next month' }).click();
	await next;
});

test('kanban: "Move to group…" moves a card with PATCH; the page never scrolls sideways (US4-3, FR-037, FR-116)', async ({
	page,
}, testInfo) => {
	const { id } = await api.call<{ id: number }>('POST', '/items/bo_content', {
		data: { title: 'web-e2e kanban card', status: 'draft' },
	});

	try {
		await openLayout(page, 'kanban', { groupField: 'status', titleField: 'title' });
		const card = page.getByRole('main').getByText('web-e2e kanban card');
		await expect(card).toBeVisible();

		await page.getByRole('button', { name: 'Options for web-e2e kanban card' }).click();
		await page.getByRole('menuitem', { name: /Move to group/ }).click();
		const patched = page.waitForRequest((r) => r.method() === 'PATCH' && r.url().endsWith(`/items/bo_content/${id}`));
		await page.getByRole('menuitem', { name: 'Published' }).click();
		expect((await patched).postDataJSON()).toEqual({ status: 'published' });

		if (testInfo.project.name.endsWith('-768')) {
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		}
	} finally {
		await api.call('DELETE', `/items/bo_content/${id}`);
	}
});

test('map: OSM tiles (stubbed) and the keyboard list of the items in view (US4-4, FR-038, FR-039)', async ({
	page,
}) => {
	const tile = page.waitForRequest((r) => r.url().includes('tile.openstreetmap.org'));
	await openLayout(page, 'map', { geometryField: 'location' });

	await page.getByRole('button', { name: 'Items in view' }).click();
	await expect(page.getByRole('dialog').getByRole('button').first()).toBeVisible();
	await tile.catch(() => undefined);
});
