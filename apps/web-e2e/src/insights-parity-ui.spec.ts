// Feature 018 T112 (SC-004): the Insights, Activity and notifications screens of the Directus app (DIRECTUS_URL/admin)
// and of the new app show the same (a) fixture rows of the dashboards table and of the Insights sub-menu, and the
// Activity sub-menu, (b) titles of the overview, the bo_dash_all page, its metric panel drawer, /activity, the activity
// drawer and the notifications drawer, (c) columns and rows of the activity table filtered on `collection`
// bo_insights_data (only the seed writes it; rows with the same timestamp compare as a set; the filter is the one of the
// admin's directus_activity preset, set through the API), (d) the fields of the activity drawer of the newest of those
// rows, (e) the subjects and times of the notifications drawer in both tabs and the badge number, (f) on, off or absent
// of the create, export, delete, edit, create panel, Save, Clear Changes, Archive and notification Delete buttons, for
// the admin and for a user who only reads dashboards and panels. Read only (the activity preset excepted, deleted
// after). Text by `innerText` without icon ligatures, state by `disabled`/`aria-disabled`. Runs in E2E_CONFIG=proxy-api
// only and drives the Directus app, so chromium-1280 only (DIRECTUS_APP_SPECS).
import type { Locator, Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, CONTENT_URL, directusUrl, e2eConfig } from './helpers/config.js';
import {
	goto as gotoDirectus,
	headerButton,
	onDirectusApp,
	openDirectusDashboard,
	openDirectusNotifications,
	type SignIn,
} from './helpers/directus-app.js';
import { Fixtures } from './helpers/fixtures.js';
import { dashboardId, DASHBOARDS } from './helpers/insights.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';
import { openNotificationsDrawer } from './helpers/layout.js';

test.skip(e2eConfig !== 'proxy-api', 'compares with the Directus app of the main pair (proxy-api only)');
test.use({ actionTimeout: 15_000 });
test.describe.configure({ mode: 'default' });
test.setTimeout(300_000);

type Ui = {
	dashboards: string[];
	insightsNav: string[];
	activityNav: string[];
	titles: string[];
	activityColumns: string[];
	activityRows: string[];
	activityDrawer: string[];
	inbox: string[];
	archive: string[];
	badge: string;
};

type Buttons = Record<string, string>;

let api: AdminApi;
let fixtures: Fixtures;
let ids: { all: string; metric: string; activity: string };

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	const all = await dashboardId(api, DASHBOARDS.all);
	const [metric] = await api.call<{ id: string }[]>(
		'GET',
		`/panels?filter[dashboard][_eq]=${all}&filter[type][_eq]=metric&fields=id&limit=1`,
	);
	const [activity] = await api.call<{ id: number }[]>(
		'GET',
		'/activity?filter[collection][_eq]=bo_insights_data&sort=-id&fields=id&limit=1',
	);
	ids = { all, metric: metric!.id, activity: String(activity!.id) };
});

test.afterAll(async () => {
	await clearActivityPresets();
	await fixtures.cleanup();
	await resetLastPage(api);
});

async function clearActivityPresets() {
	const presets = await api.call<{ id: number }[]>(
		'GET',
		'/presets?filter[collection][_eq]=directus_activity&filter[user][_eq]=$CURRENT_USER&filter[bookmark][_null]=true&fields=id',
	);
	for (const { id } of presets) await api.call('DELETE', `/presets/${id}`);
}

/* ------------------------------------------------------------------------------------------- page readers */

/** Runs in the page of either app: the text of `el` without icon ligatures, screen-reader texts and SVG. */
function labelOf(el: Element): string {
	const copy = el.cloneNode(true) as HTMLElement;
	copy.querySelectorAll('[data-icon], .sr-only, svg').forEach((e) => e.remove());
	return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Runs in the page of either app: the non-empty cell labels of the body rows of the main table, ` | ` joined. */
function readRows(): string[] {
	const label = (el: Element) => {
		const copy = el.cloneNode(true) as HTMLElement;
		copy.querySelectorAll('[data-icon], .sr-only, svg').forEach((e) => e.remove());
		return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
	};
	return Array.from(document.querySelectorAll('main tbody tr')).map((tr) =>
		Array.from(tr.querySelectorAll('td')).map(label).filter(Boolean).join(' | '),
	);
}

/** Runs in the page of either app: the non-empty header cell labels of the main table. */
function readColumns(): string[] {
	const label = (el: Element) => {
		const copy = el.cloneNode(true) as HTMLElement;
		copy.querySelectorAll('[data-icon], .sr-only, svg').forEach((e) => e.remove());
		return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
	};
	return Array.from(document.querySelectorAll('main thead th')).map(label).filter(Boolean);
}

/** Rows grouped by their timestamp cell (the third), each group sorted: same-time rows compare as a set. */
function bySet(rows: string[]): string[] {
	const groups = new Map<string, string[]>();
	for (const row of rows) {
		const time = row.split(' | ')[2] ?? '';
		groups.set(time, [...(groups.get(time) ?? []), row]);
	}
	return [...groups.values()].flatMap((group) => group.sort());
}

/** `on`, `off` or `absent` of the first control `control` finds. */
async function controlState(control: Locator): Promise<string> {
	if ((await control.count()) === 0 || !(await control.first().isVisible())) return 'absent';
	const el = control.first();
	const off =
		(await el.isDisabled()) ||
		(await el.getAttribute('aria-disabled')) === 'true' ||
		((await el.getAttribute('class')) ?? '').split(' ').includes('disabled');
	return off ? 'off' : 'on';
}

/** The answer to the list request of a drawer tab (a tab shows the old rows until it arrives). */
const tabList = (p: Page, status: 'inbox' | 'archived') =>
	p.waitForResponse(
		(r) =>
			r.request().method() === 'GET' &&
			/\/notifications\?/.test(r.url()) &&
			decodeURIComponent(r.url()).includes(status) &&
			r.url().includes('limit'),
	);

const fixtureRows = (rows: string[]) => rows.filter((row) => row.startsWith('bo_dash_'));

/* ------------------------------------------------------------------------------------------- Directus app */

const dirTitle = (p: Page, root = 'header.header-bar') => p.locator(`${root} .title`).first().innerText();
const dirNav = (p: Page) =>
	p.locator('.module-nav .v-list-item').evaluateAll((items) =>
		items.map((item) => {
			const copy = (item.querySelector('.v-list-item-content') ?? item).cloneNode(true) as HTMLElement;
			copy.querySelectorAll('[data-icon]').forEach((e) => e.remove());
			return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
		}),
	);

async function directusUi(p: Page): Promise<Ui> {
	const titles: string[] = [];

	await gotoDirectus(p, '/insights');
	await expect(p.locator('.table-row').first()).toBeVisible();
	titles.push(await dirTitle(p));
	const dashboards = fixtureRows(await p.evaluate(readRows));
	const insightsNav = fixtureRows(await dirNav(p));

	await openDirectusDashboard(p, ids.all);
	titles.push(await dirTitle(p));
	await p.goto(`${directusUrl}/admin/insights/${ids.all}/${ids.metric}`);
	await expect(p.locator('.v-drawer')).toBeVisible({ timeout: 15_000 });
	titles.push(await dirTitle(p, '.v-drawer header.header-bar'));

	await gotoDirectus(p, '/activity');
	await expect(p.locator('.table-row').first()).toBeVisible();
	await p.waitForLoadState('networkidle');
	titles.push(await dirTitle(p));
	const activityNav = await dirNav(p);
	const activityColumns = await p.evaluate(readColumns);
	const activityRows = bySet(await p.evaluate(readRows));

	await p.goto(`${directusUrl}/admin/activity/${ids.activity}`);
	const drawer = p.locator('.v-drawer').last();
	const content = drawer.locator('div.content:has(> p.type-label)');
	await expect(content).toBeVisible({ timeout: 15_000 });
	titles.push(await dirTitle(p, '.v-drawer header.header-bar'));
	const activityDrawer = (await content.innerText())
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	await gotoDirectus(p, '/insights');
	await expect(p.locator('.notifications-badge .badge')).toBeVisible();
	const badge = (await p.locator('.notifications-badge .badge').innerText()).trim();
	const notifications = await openDirectusNotifications(p);
	titles.push(await dirTitle(p, '.v-drawer header.header-bar'));
	const rows = () =>
		notifications
			.locator('.notifications .v-list-item .header')
			.evaluateAll((headers) =>
				headers.map(
					(h) =>
						`${h.querySelector('.title')?.textContent?.trim() ?? ''} | ${h.querySelector('.datetime')?.textContent?.trim() ?? ''}`,
				),
			);
	const inbox = await rows();
	const archived = tabList(p, 'archived');
	await notifications.locator('.v-tab', { hasText: 'Archive' }).click();
	await archived;
	await p.waitForTimeout(500);
	const archive = await rows();

	return {
		dashboards,
		insightsNav,
		activityNav,
		titles,
		activityColumns,
		activityRows,
		activityDrawer,
		inbox,
		archive,
		badge,
	};
}

async function directusButtons(p: Page): Promise<Buttons> {
	const buttons: Buttons = {};
	await gotoDirectus(p, '/insights');
	await expect(p.locator('.table-row').first()).toBeVisible();
	buttons['createDashboard'] = await controlState(headerButton(p, 'add'));
	buttons['export'] = await controlState(headerButton(p, 'download'));
	buttons['delete'] = await controlState(headerButton(p, 'delete'));
	await p.locator('.table-row', { hasText: DASHBOARDS.all }).locator('.v-checkbox').click();
	buttons['exportSelected'] = await controlState(headerButton(p, 'download'));
	buttons['deleteSelected'] = await controlState(headerButton(p, 'delete'));

	await openDirectusDashboard(p, ids.all);
	buttons['edit'] = await controlState(headerButton(p, 'edit'));
	if (buttons['edit'] === 'on') {
		await headerButton(p, 'edit').click();
		await expect(headerButton(p, 'check')).toBeVisible();
	}
	buttons['createPanel'] = await controlState(p.getByRole('banner').getByRole('link', { name: 'add', exact: true }));
	buttons['save'] = await controlState(headerButton(p, 'check'));
	buttons['clearChanges'] = await controlState(headerButton(p, 'clear'));

	await gotoDirectus(p, '/insights');
	const drawer = await openDirectusNotifications(p);
	const archive = drawer.getByRole('button', { name: 'archive', exact: true });
	const remove = drawer.getByRole('button', { name: 'delete', exact: true });
	buttons['archive'] = await controlState(archive);
	buttons['notificationDelete'] = await controlState(remove);
	const first = drawer.locator('.notifications .v-list-item .v-checkbox').first();
	if (await first.count()) {
		await first.click();
		buttons['archiveSelected'] = await controlState(archive);
		buttons['notificationDeleteSelected'] = await controlState(remove);
	}
	// Nothing is archived or deleted: the selection is dropped with the drawer.
	return buttons;
}

/* ------------------------------------------------------------------------------------------- Backoffice app */

const boTitle = (p: Page, root = 'main h1') => p.locator(root).first().evaluate(labelOf);

async function signIn(p: Page, user: SignIn) {
	await api.call('PATCH', user.id ? `/users/${user.id}` : '/users/me', { data: { last_page: null } });
	await api.call('POST', '/utils/cache/clear');
	await p.context().clearCookies();
	await p.goto('/admin/login');
	await login(p, user);
	await expect(p).toHaveURL(CONTENT_URL);
}

async function backofficeUi(p: Page): Promise<Ui> {
	const titles: string[] = [];
	const navLinks = (name: string) =>
		p
			.getByRole('navigation', { name, exact: true })
			.locator('a, button')
			.evaluateAll((items) =>
				items.map((item) => {
					const copy = item.cloneNode(true) as HTMLElement;
					copy.querySelectorAll('[data-icon], .sr-only').forEach((e) => e.remove());
					return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
				}),
			);

	await p.goto('/admin/insights');
	await expect(p.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
	titles.push(await boTitle(p));
	const dashboards = fixtureRows(await p.evaluate(readRows));
	const insightsNav = fixtureRows(await navLinks('Insights'));

	await p.goto(`/admin/insights/${ids.all}`);
	await expect(p.locator('[data-panel-id]').first()).toBeVisible({ timeout: 15_000 });
	titles.push(await boTitle(p));
	await p.goto(`/admin/insights/${ids.all}/${ids.metric}`);
	await expect(p.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
	titles.push(await boTitle(p, '[role="dialog"] h2'));

	await p.goto('/admin/activity');
	await expect(p.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
	await p.waitForLoadState('networkidle');
	titles.push(await boTitle(p));
	const activityNav = await navLinks('Activity');
	const activityColumns = await p.evaluate(readColumns);
	const activityRows = bySet(await p.evaluate(readRows));

	await p.goto(`/admin/activity/${ids.activity}`);
	const drawer = p.getByRole('dialog');
	await expect(drawer.locator('dl')).toBeVisible({ timeout: 15_000 });
	titles.push(await boTitle(p, '[role="dialog"] h2'));
	const activityDrawer = (
		await drawer.locator('dl').evaluate((dl) =>
			Array.from(dl.children)
				.flatMap((child) => (child.tagName === 'DIV' ? Array.from(child.children) : [child]))
				.map((el) => (el as HTMLElement).innerText),
		)
	)
		.flatMap((text) => text.split('\n'))
		.map((line) => line.trim())
		.filter(Boolean);

	await p.goto('/admin/insights');
	await expect(p.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
	await expect(p.locator('[data-testid="notifications-badge"]')).toBeVisible();
	const badge = ((await p.locator('[data-testid="notifications-badge"]').textContent()) ?? '').trim();
	const inboxList = tabList(p, 'inbox');
	await openNotificationsDrawer(p);
	const notifications = p.getByRole('dialog', { name: 'Notifications', exact: true });
	await expect(notifications).toBeVisible();
	await inboxList;
	await p.waitForTimeout(500);
	titles.push(await boTitle(p, '[role="dialog"] h2'));
	const rows = () =>
		notifications
			.locator('[data-notification]')
			.evaluateAll((items) =>
				items.map(
					(li) =>
						`${li.querySelector('time')?.previousElementSibling?.textContent?.trim() ?? ''} | ${li.querySelector('time')?.textContent?.trim() ?? ''}`,
				),
			);
	const inbox = await rows();
	const archived = tabList(p, 'archived');
	await notifications.getByRole('tab', { name: 'Archive' }).click();
	await archived;
	await p.waitForTimeout(500);
	const archive = await rows();
	await p.keyboard.press('Escape');

	return {
		dashboards,
		insightsNav,
		activityNav,
		titles,
		activityColumns,
		activityRows,
		activityDrawer,
		inbox,
		archive,
		badge,
	};
}

async function backofficeButtons(p: Page): Promise<Buttons> {
	const buttons: Buttons = {};
	const header = p.getByRole('main');
	await p.goto('/admin/insights');
	await expect(p.locator('main tbody tr').first()).toBeVisible({ timeout: 15_000 });
	// By icon, like the Directus header buttons: without the permission their name is "Not allowed".
	const icon = (name: string) => header.locator(`button:has([data-icon="${name}"])`);
	buttons['createDashboard'] = await controlState(icon('add'));
	buttons['export'] = await controlState(icon('download'));
	buttons['delete'] = await controlState(icon('delete'));
	await p.getByRole('row').filter({ hasText: DASHBOARDS.all }).getByRole('checkbox').click();
	buttons['exportSelected'] = await controlState(icon('download'));
	buttons['deleteSelected'] = await controlState(icon('delete'));

	await p.goto(`/admin/insights/${ids.all}`);
	await expect(p.locator('[data-panel-id]').first()).toBeVisible({ timeout: 15_000 });
	const edit = p.getByRole('button', { name: 'Edit Panels' });
	buttons['edit'] = await controlState(edit);
	if (buttons['edit'] === 'on') {
		await edit.click();
		await expect(p.getByRole('button', { name: 'Save' })).toBeVisible();
	}
	buttons['createPanel'] = await controlState(header.getByRole('link', { name: 'Create Panel' }));
	buttons['save'] = await controlState(header.getByRole('button', { name: 'Save', exact: true }));
	buttons['clearChanges'] = await controlState(header.getByRole('button', { name: 'Clear Changes' }));

	await p.goto('/admin/insights');
	await openNotificationsDrawer(p);
	const drawer = p.getByRole('dialog', { name: 'Notifications', exact: true });
	await expect(drawer).toBeVisible();
	await p.waitForLoadState('networkidle');
	const archive = drawer.getByRole('button', { name: 'Archive', exact: true });
	const remove = drawer.getByRole('button', { name: 'Delete', exact: true });
	buttons['archive'] = await controlState(archive);
	buttons['notificationDelete'] = await controlState(remove);
	const first = drawer.locator('[data-notification]').getByRole('checkbox').first();
	if (await first.count()) {
		await first.click();
		buttons['archiveSelected'] = await controlState(archive);
		buttons['notificationDeleteSelected'] = await controlState(remove);
	}
	await p.keyboard.press('Escape');
	return buttons;
}

/* ------------------------------------------------------------------------------------------- tests */

test('admin: dashboards table, sub-menus, titles, activity table and drawer, notifications drawer and badge match the Directus app (SC-004 (a)–(e))', async ({
	page,
	browser,
}) => {
	const me = (await api.call<{ id: string }>('GET', '/users/me?fields=id')).id;
	await clearActivityPresets();
	await api.call('POST', '/presets', {
		data: { user: me, collection: 'directus_activity', filter: { collection: { _eq: 'bo_insights_data' } } },
	});

	const directus = await onDirectusApp(browser, directusUi);
	await signIn(page, ADMIN);
	const backoffice = await backofficeUi(page);

	expect(directus.activityRows.length).toBeGreaterThan(0);
	expect(directus.inbox.length).toBeGreaterThan(0);
	// The apps are read one after the other: "35 minutes ago" can turn "36 minutes ago" in between (CI 39603142732).
	const relative = (value: unknown) =>
		JSON.parse(JSON.stringify(value).replace(/\b\d+ (second|minute|hour)s? ago\b/g, 'N $1(s) ago'));
	for (const key of Object.keys(directus) as (keyof Ui)[])
		expect.soft(relative(backoffice[key]), key).toEqual(relative(directus[key]));
});

test('buttons on, off or absent for the admin and a user who only reads dashboards (SC-004 (f))', async ({
	page,
	browser,
}) => {
	// bo_insights_data too: without it both apps throw while building the panel query (query-to-gql-string.ts
	// formatQuery reads the primary key of a collection the fields store does not have).
	const role = await fixtures.role('insights parity reader', {
		read: ['directus_dashboards', 'directus_panels', 'bo_insights_data'],
	});
	const reader = await fixtures.user('insights-parity-reader', { role });

	for (const user of [ADMIN, reader] as SignIn[]) {
		const directus = await onDirectusApp(browser, directusButtons, user);
		await signIn(page, user);
		const backoffice = await backofficeButtons(page);
		expect.soft(backoffice, user.email).toEqual(directus);
	}
});
