// Feature 016 US7 (T112, SC-004): the 13 Settings screens of the Directus app (DIRECTUS_URL/admin) and of the new app
// show the same (a) sub-menu labels in order and collection tree, (b) title and breadcrumb, (c) count lines (users and
// roles of the role and policy lists, bookmarks and presets, item counts) and permission chip labels, (d) state of the
// 14 buttons (create folder, create collection, delete collection, save collection, create field, next, finish, save
// field, create role, invite, delete role, create policy, duplicate policy, create preset: on, off or absent) and (e)
// detail-panel sections, for the admin (non-admins have no Settings module, FR-061). Read only: the new-collection
// drawer is filled but never saved. Runs in E2E_CONFIG=proxy-api only and drives the Directus app, so chromium-1280
// only (DIRECTUS_APP_SPECS). Deviations the spec allows are applied to the Directus values in `allowed`, each with its D-xx.
import type { Locator, Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, DATA_PREFIX, directusUrl, e2eConfig } from './helpers/config.js';
import { chooseInMenu, dirTile, goto as gotoDirectus, headerButton, onDirectusApp } from './helpers/directus-app.js';
import { flowId, FLOWS, panel } from './helpers/flows.js';
import { openSidebar } from './helpers/content.js';
import { moduleBar } from './helpers/layout.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'compares with the Directus app of the main pair (proxy-api only)');
test.use({ actionTimeout: 15_000 });

/** Header buttons compared, by icon (the new-collection drawer's next is `arrow_forward`; save and finish are `check`). */
const ICONS = ['create_new_folder', 'add', 'delete', 'check', 'person_add', 'arrow_forward'];
/** Fixture rows of the role and policy lists (other specs add prefixed rows at the same time). */
const ROWS = ['Public', 'Administrator', 'bo-editor', 'bo-viewer', 'bo-sub', 'bo-settings-role', 'bo-settings-policy'];
/** Permission rows whose chips are compared on the policy page: custom levels and two app-minimal system rows. */
const CHIP_ROWS = ['bo_std', 'directus_activity', 'directus_comments'];
const LEVELS = ['all', 'none', 'custom', 'partial'];
const COUNT = /^(No|One|\d[\d,.]*) Items?/;
// Never saved: only typed into the new-collection drawer to enable "next".
const NEW_COLLECTION = `${DATA_PREFIX.replaceAll('-', '_')}_parity`;

type Screen = {
	nav: string[];
	tree: string[];
	title: string;
	crumbs: string[];
	count: string;
	buttons: string[];
	rows: string[];
	chips: string[];
	sections: string[];
};

/** The buttons that live outside the page header: in a drawer, in the field list or in a row menu. */
type Extra = {
	createField: string;
	newCollection: string[];
	finish: string[];
	fieldDrawer: string[];
	duplicatePolicy: string[];
};

const SCREENS = [
	'dataModel',
	'collection',
	'roles',
	'role',
	'public',
	'policies',
	'policy',
	'project',
	'appearance',
	'presets',
	'preset',
	'translations',
	'translation',
] as const;
type ScreenName = (typeof SCREENS)[number];

/**
 * Directus values the spec lets the new app show differently, rewritten to what the new app shows. Every other
 * difference fails the test.
 */
function allowed(screen: Screen): Screen {
	const nav = screen.nav
		// D-93: AI, Marketplace (until spec 020 wave 3) and System Logs are not registered and have no sub-menu row.
		.filter((row) => !['AI', 'Marketplace', 'System Logs'].includes(row))
		// D-94: no Report Bug / Request Feature rows. D-95: no "Directus <version>" row.
		.filter((row) => !['Report Bug', 'Request Feature'].includes(row) && !/^Directus \d/.test(row));
	return { ...screen, nav };
}

/** Only the fixture collections: other specs create and drop prefixed collections while this one runs. */
const fixtureTree = (tree: string[]) => tree.filter((name) => /^(bo_|directus_)/.test(name));

let api: AdminApi;
let paths: Record<ScreenName, string>;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const one = async (path: string) => (await api.call<{ id: string }[]>('GET', path))[0]!.id;
	paths = {
		dataModel: '/settings/data-model',
		collection: '/settings/data-model/bo_std',
		roles: '/settings/roles',
		role: `/settings/roles/${await one('/roles?fields=id&filter[name][_eq]=bo-settings-role')}`,
		public: '/settings/roles/public',
		policies: '/settings/policies',
		policy: `/settings/policies/${await one('/policies?fields=id&filter[name][_eq]=bo-settings-policy')}`,
		project: '/settings/project',
		appearance: '/settings/appearance',
		presets: '/settings/presets',
		// The fixture preset 1 (the admin's bo_content table preset).
		preset: '/settings/presets/1',
		translations: '/settings/translations',
		translation: `/settings/translations/${await one('/translations?fields=id&filter[key][_eq]=bo_hello&filter[language][_eq]=en-US')}`,
	};
});

test.afterAll(async () => {
	await resetLastPage(api);
});

/** Runs in the page of either app: the fixture rows of the list tables and the chips of the permission rows. */
function readTables(args: { rows: string[]; chipRows: string[]; levels: string[] }) {
	const label = (el: Element) => {
		const copy = el.cloneNode(true) as HTMLElement;
		copy.querySelectorAll('[data-icon], .sr-only, svg').forEach((e) => e.remove());
		return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
	};
	const rows = Array.from(document.querySelectorAll('main tbody tr'))
		.map((tr) => Array.from(tr.querySelectorAll('td')).map(label).filter(Boolean))
		.filter((cells) => args.rows.includes(cells[0] ?? ''))
		.map((cells) => cells.join(' | '));
	// The chip text and its level class (Directus `permissionLevel` on the chip, `appMinimalLevel` on its wrapper).
	const chips = args.chipRows.flatMap((collection) =>
		Array.from(document.querySelectorAll(`tr[data-collection="${collection}"] td.action`)).map((td) => {
			const level = Array.from(td.querySelectorAll('*'))
				.flatMap((e) => Array.from(e.classList))
				.find((c) => args.levels.includes(c));
			return `${collection} ${label(td)}:${level ?? ''}`;
		}),
	);
	return { rows, chips };
}

/**
 * Runs in the page of either app: `icon:on|off` of the buttons and links inside the first element matching `root`, or
 * (no `root`) inside the actions of the new app's page header.
 */
function buttonsIn(args: { root?: string; last?: boolean; icons: string[] }): string[] {
	const roots = args.root ? Array.from(document.querySelectorAll(args.root)) : [];
	const root = args.root
		? args.last
			? roots.pop()
			: roots[0]
		: document.querySelector('main h1')?.closest('.mb-6')?.lastElementChild;
	return (
		Array.from(root?.querySelectorAll('button, a') ?? [])
			// A control inside another one (a link around a button) counts once; the closed Directus filter keeps a hidden
			// "Add Filter" button in the header.
			.filter((control) => !control.parentElement?.closest('button, a') && (control as HTMLElement).checkVisibility())
			.map((control) => {
				const icon = control.querySelector('[data-icon]')?.getAttribute('data-icon') ?? '';
				const off =
					(control.hasAttribute('disabled') && control.getAttribute('disabled') !== 'false') ||
					control.getAttribute('aria-disabled') === 'true';
				return args.icons.includes(icon) ? `${icon}:${off ? 'off' : 'on'}` : '';
			})
			.filter(Boolean)
			.sort()
	);
}

async function directusScreen(page: Page, path: string): Promise<Screen> {
	await gotoDirectus(page, path);
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(800);
	// The Information section (bookmark and preset counts) and the system collections open on click.
	if (path === '/settings/presets')
		await page.locator('#sidebar .accordion-trigger', { hasText: 'Information' }).click();
	if (path === '/settings/data-model')
		await page.locator('main .v-detail .activator', { hasText: 'System Collections' }).click();
	await page.waitForTimeout(300);

	const tables = await page.evaluate(readTables, { rows: ROWS, chipRows: CHIP_ROWS, levels: LEVELS });
	const main = await page.evaluate(
		({ count }) => {
			const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
			const header = document.querySelector('header.header-bar');
			const info = Array.from(document.querySelectorAll('#sidebar dl > div')).map((d) =>
				`${text(d.querySelector('dt'))} ${text(d.querySelector('dd'))}`.trim(),
			);

			return {
				nav: Array.from(document.querySelectorAll('.module-nav .v-list-item')).map((i) =>
					text(i.querySelector('.v-list-item-content') ?? i),
				),
				tree: Array.from(
					document.querySelectorAll(
						'main .collection-item-detail .collection-name, main .db-only span.collection-name',
					),
				)
					.filter((el) => (el as HTMLElement).checkVisibility())
					.map(text),
				title: text(header?.querySelector('.title') ?? null),
				// D-101 of 016: the new app shows no breadcrumb (owner, 2026-10-17); its crumbs must be empty.
				crumbs: [] as string[],
				count: [new RegExp(count).exec(text(document.querySelector('.item-count')))?.[0] ?? '', ...info]
					.filter(Boolean)
					.join(' / '),
				sections: Array.from(document.querySelectorAll('#sidebar .accordion-trigger, #sidebar .collapsible-trigger'))
					.map(text)
					// D-41: the Directus-only AI Assistant section.
					.filter((t) => t && t !== 'AI Assistant')
					// A count badge comes before the name in the Directus DOM ("1Revisions"): "Revisions 1".
					.map((t) => `${t.replace(/\d+/g, '').trim()} ${t.replace(/\D+/g, '')}`.trim()),
			};
		},
		{ count: COUNT.source },
	);
	const buttons = await page.evaluate(buttonsIn, { root: 'header.header-bar', icons: ICONS });
	return { ...main, ...tables, buttons };
}

async function backofficeScreen(page: Page, path: string): Promise<Screen> {
	await page.goto(`/admin${path}`);
	await expect(page.locator('main h1')).toBeVisible({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(800);
	await openSidebar(page);
	if (path === '/settings/presets')
		await page.locator('#sidebar').getByRole('button', { name: 'Information', exact: true }).click();
	if (path === '/settings/data-model')
		await page.getByRole('main').getByRole('button', { name: 'System Collections', exact: true }).click();
	await page.waitForTimeout(300);

	const tables = await page.evaluate(readTables, { rows: ROWS, chipRows: CHIP_ROWS, levels: LEVELS });
	const main = await page.evaluate(
		({ count }) => {
			const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
			// The text without icon ligatures and screen-reader texts.
			const label = (el: Element) => {
				const copy = el.cloneNode(true) as HTMLElement;
				copy.querySelectorAll('[data-icon], .sr-only, button').forEach((e) => e.remove());
				return text(copy);
			};
			const h1 = document.querySelector('main h1')!;
			const header = h1.closest('.mb-6');
			const status = Array.from(document.querySelectorAll('main [role="status"]'))
				.map(text)
				.find((t) => new RegExp(count).test(t));
			const info = Array.from(document.querySelectorAll('#sidebar dl > div')).map((d) =>
				`${text(d.querySelector('dt'))} ${text(d.querySelector('dd'))}`.trim(),
			);

			return {
				title: label(h1),
				crumbs: Array.from(header?.querySelectorAll('nav[aria-label="Breadcrumb"] a') ?? []).map(label),
				// The collection tree, the database-only list and the system collections of the data model page.
				// 018 D-118: the app shows system keys as `backoffice_*` (display only); compared as the stored key.
				tree: Array.from(document.querySelectorAll('main span.font-mono'))
					.filter((el) => (el as HTMLElement).checkVisibility())
					.map(text)
					.map((name) => name.replace(/^backoffice_/, 'directus_')),
				count: [status ? new RegExp(count).exec(status)![0] : '', ...info].filter(Boolean).join(' / '),
			};
		},
		{ count: COUNT.source },
	);
	const buttons = await page.evaluate(buttonsIn, { icons: ICONS });

	// Below `xl` the navigation is a drawer; chromium-1280 is at `xl`, the module bar holds the sub-menu.
	const bar = await moduleBar(page);
	const nav = await bar.evaluate((root) =>
		Array.from(root.querySelectorAll('nav[aria-label="Settings"] li > a')).map((row) => {
			const copy = row.cloneNode(true) as HTMLElement;
			copy.querySelectorAll('[data-icon], .sr-only, button').forEach((e) => e.remove());
			return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
		}),
	);

	const sections = (await page.locator('#sidebar h3').allTextContents())
		.map((t) => t.replace(/expand_more|[a-z_]+(?=[A-Z])/g, '').trim())
		.map((t) => `${t.replace(/\d+/g, '').trim()} ${t.replace(/\D+/g, '')}`.trim());

	return { ...main, ...tables, buttons, nav, sections };
}

/** `on|off|absent` of the button or link whose whole text is `name`, inside `root`. */
async function stateByText(page: Page, root: string, name: string): Promise<string> {
	return page.evaluate(
		({ root, name }) => {
			const label = (el: Element) => {
				const copy = el.cloneNode(true) as HTMLElement;
				copy.querySelectorAll('[data-icon], .sr-only').forEach((e) => e.remove());
				return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
			};
			const control = Array.from(document.querySelectorAll(`${root} button, ${root} a`)).find(
				(el) => label(el) === name,
			);
			if (!control) return 'absent';
			const off =
				(control.hasAttribute('disabled') && control.getAttribute('disabled') !== 'false') ||
				control.getAttribute('aria-disabled') === 'true';
			return off ? 'off' : 'on';
		},
		{ root, name },
	);
}

async function directusExtra(page: Page): Promise<Extra> {
	const drawer = async (p: Page) => [
		((await p.locator('.v-drawer header.header-bar .title').last().textContent()) ?? '').trim(),
		...(await p.evaluate(buttonsIn, { root: '.v-drawer header.header-bar', last: true, icons: ICONS })),
	];

	await gotoDirectus(page, '/settings/data-model/bo_std');
	await expect(page.locator('.v-button', { hasText: 'Create Field' })).toBeVisible();
	const createField = await stateByText(page, 'main', 'Create Field');

	// A drawer route has two `main` elements: open it without `goto` (which waits for one).
	await page.goto(`${directusUrl}/admin/settings/data-model/+`);
	await expect(page.locator('.v-drawer')).toBeVisible({ timeout: 15_000 });
	await page.waitForTimeout(500);
	const newCollection = await drawer(page);
	await page.locator('.v-drawer input').first().fill(NEW_COLLECTION);
	await page.locator('.v-drawer header .v-button', { has: page.locator('[data-icon="arrow_forward"]') }).click();
	await page.waitForTimeout(500);
	const finish = await drawer(page);

	await page.goto(`${directusUrl}/admin/settings/data-model/bo_std/input_string`);
	await expect(page.locator('.v-drawer')).toBeVisible({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
	const fieldDrawer = await drawer(page);

	await gotoDirectus(page, '/settings/policies');
	await page.locator('main tbody tr', { hasText: 'bo-settings-policy' }).locator('.ctx-toggle').click();
	const menu = page.locator('.v-menu-content').last();
	await expect(menu).toBeVisible();
	const duplicatePolicy = (await menu.locator('.v-list-item').allTextContents()).map((t) =>
		t.replace(/content_copy/g, '').trim(),
	);

	return { createField, newCollection, finish, fieldDrawer, duplicatePolicy };
}

async function backofficeExtra(page: Page): Promise<Extra> {
	const drawer = async (p: Page) => [
		((await p.locator('[role="dialog"] header h2').last().textContent()) ?? '').trim(),
		...(await p.evaluate(buttonsIn, { root: '[role="dialog"] header', last: true, icons: ICONS })),
	];

	await page.goto('/admin/settings/data-model/bo_std');
	await expect(page.getByRole('main').getByRole('link', { name: 'Create Field', exact: true })).toBeVisible({
		timeout: 15_000,
	});
	const createField = await stateByText(page, 'main', 'Create Field');

	await page.goto('/admin/settings/data-model/+');
	await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
	await page.waitForTimeout(500);
	const newCollection = await drawer(page);
	await page.locator('#new-collection-name').fill(NEW_COLLECTION);
	await page.getByRole('dialog').locator('header button:has([data-icon="arrow_forward"])').click();
	await page.waitForTimeout(500);
	const finish = await drawer(page);

	await page.goto('/admin/settings/data-model/bo_std/input_string');
	await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
	const fieldDrawer = await drawer(page);

	await page.goto('/admin/settings/policies');
	await page.getByRole('button', { name: 'Options for bo-settings-policy', exact: true }).click();
	const duplicatePolicy = (await page.getByRole('menuitem').allTextContents()).map((t) =>
		t.replace(/content_copy/g, '').trim(),
	);

	return { createField, newCollection, finish, fieldDrawer, duplicatePolicy };
}

test('admin: sub-menu, tree, titles, breadcrumbs, counts, chips, 14 buttons and panel sections match the Directus app (SC-004)', async ({
	page,
	browser,
}) => {
	test.setTimeout(300_000);
	const directus = await onDirectusApp(browser, async (p) => {
		const screens: Partial<Record<ScreenName, Screen>> = {};
		for (const screen of SCREENS) screens[screen] = await directusScreen(p, paths[screen]);
		return { screens, extra: await directusExtra(p) };
	});

	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);

	for (const screen of SCREENS) {
		const backoffice = await backofficeScreen(page, paths[screen]);
		const expected = allowed(directus.screens[screen]!);
		// The tree is read on the data model page only (other pages list fields in the same monospace style).
		const tree = (shown: Screen) => ({ ...shown, tree: screen === 'dataModel' ? fixtureTree(shown.tree) : [] });
		expect.soft(tree(backoffice), screen).toEqual(tree(expected));
	}

	expect.soft(await backofficeExtra(page), 'create field, drawers and duplicate policy').toEqual(directus.extra);
});

/* ------------------------------------------------------------------------------------------- feature 017: Flows */

// Feature 017 T092 (SC-004): the Flows screens of both apps on the bo_flows fixture: (a) the fixture rows of the flow
// table with their status, (b) the titles of the flow table, the bo_all_ops page, the flow drawer and the operation
// drawer, and the type and name of every bo_all_ops panel, (c) the overview `<dl>` of its 16 panels and of the trigger
// of the other 4 fixture flows (the webhook URL compared from `/flows/trigger/`), (d) on/off/absent of the 9 buttons,
// (e) the detail-panel sections with the Logs badge. Read only: the drawers are closed and the canvas never saved.

type FlowsUi = {
	rows: string[];
	titles: string[];
	panels: string[];
	triggers: string[];
	buttons: Record<string, string>;
	sections: string[];
};

const FIXTURE_FLOWS = Object.values(FLOWS) as string[];
const OTHER_TRIGGERS = [FLOWS.webhook, FLOWS.schedule, FLOWS.child, FLOWS.event];

/** Runs in the page of either app: `<name>:<status>` of the fixture rows of the flow table, in table order. */
function readFlowRows(names: string[]): string[] {
	return Array.from(document.querySelectorAll('main tbody tr'))
		.map((row) => {
			const text = row.textContent ?? '';
			const name = names.find((n) => text.includes(n));
			return name ? `${name}:${/Inactive/.test(text) ? 'Inactive' : 'Active'}` : '';
		})
		.filter(Boolean);
}

/** Runs in the page of either app: `type | name | dt=dd...` of every panel, by cell. */
function readPanels(args: { tile: string; header: string; name: string }): string[] {
	const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
	return Array.from(document.querySelectorAll(args.tile))
		.map((tile) => {
			const style = (tile as HTMLElement).style;
			const x = Number(tile.getAttribute('data-pos-x') ?? style.getPropertyValue('--pos-x'));
			const y = Number(tile.getAttribute('data-pos-y') ?? style.getPropertyValue('--pos-y'));
			const dl = Array.from(tile.querySelectorAll('dl > div')).map(
				(d) => `${text(d.querySelector('dt'))}=${text(d.querySelector('dd'))}`,
			);
			const line = [text(tile.querySelector(args.header)), text(tile.querySelector(args.name)), ...dl]
				.join(' | ')
				// The webhook URL starts with each app's API URL.
				.replace(/\S*(\/flows\/trigger\/)/g, '$1');
			return { x, y, line };
		})
		.sort((a, b) => a.y - b.y || a.x - b.x)
		.map((p) => p.line);
}

/** `on`, `off` or `absent` of the first control `control` finds. */
async function controlState(control: Locator): Promise<string> {
	if ((await control.count()) === 0 || !(await control.first().isVisible())) return 'absent';
	const el = control.first();
	const off =
		(await el.isDisabled()) ||
		(await el.getAttribute('aria-disabled')) === 'true' ||
		(await el.getAttribute('data-disabled')) !== null ||
		((await el.getAttribute('class')) ?? '').split(' ').includes('disabled');
	return off ? 'off' : 'on';
}

const SECTIONS = (t: string) => `${t.replace(/\d+/g, '').trim()} ${t.replace(/\D+/g, '')}`.trim();

async function directusFlowsUi(p: Page, ids: { all: string; log: string; triggers: string[] }): Promise<FlowsUi> {
	const title = (root: string) => p.locator(`${root} .title`).first().innerText();
	const drawer = () => p.locator('.v-drawer').last();
	const buttons: Record<string, string> = {};

	await gotoDirectus(p, '/settings/flows');
	await expect(p.locator('main tbody tr').first()).toBeVisible();
	const rows = await p.evaluate(readFlowRows, FIXTURE_FLOWS);
	const titles = [await title('header.header-bar')];
	buttons['createFlow'] = await controlState(headerButton(p, 'add'));

	await headerButton(p, 'add').click();
	buttons['next'] = await controlState(drawer().getByRole('button', { name: 'arrow_forward', exact: true }));
	await drawer().getByPlaceholder('Name', { exact: true }).fill('parity');
	await drawer().getByRole('button', { name: 'arrow_forward', exact: true }).click();
	buttons['finishSetup'] = await controlState(drawer().getByRole('button', { name: 'check', exact: true }));
	await p.keyboard.press('Escape');
	await expect(p.locator('.v-drawer')).toHaveCount(0);

	await p.locator('.table-row', { hasText: FLOWS.all }).locator('.ctx-toggle').click();
	await chooseInMenu(p, 'Edit Flow');
	titles.push(await title('.v-drawer .header-bar'));
	buttons['saveDrawer'] = await controlState(drawer().getByRole('button', { name: 'check', exact: true }));
	await p.keyboard.press('Escape');
	await expect(p.locator('.v-drawer')).toHaveCount(0);

	await gotoDirectus(p, `/settings/flows/${ids.all}`);
	await expect(dirTile(p, 'Trigger')).toBeVisible();
	await p.waitForLoadState('networkidle');
	titles.push(await title('header.header-bar'));
	const panels = await p.evaluate(readPanels, {
		tile: '.v-workspace-tile',
		header: '.header .name',
		name: '.tile-content .name',
	});
	const sections = (await p.locator('#sidebar .accordion-trigger').allTextContents())
		.map((t) => t.replace(/\s+/g, ' ').trim())
		.filter((t) => t && t !== 'AI Assistant')
		.map(SECTIONS);
	buttons['editFlow'] = await controlState(headerButton(p, 'edit'));
	await headerButton(p, 'edit').click();
	buttons['saveCanvas'] = await controlState(headerButton(p, 'check'));
	buttons['clearChanges'] = await controlState(headerButton(p, 'clear'));
	await dirTile(p, 'Log to Console').locator('.edit-actions .more-icon').click();
	buttons['copyTo'] = await controlState(
		p.locator('.v-menu-content').last().locator('.v-list-item', { hasText: 'Copy To...' }),
	);
	await p.keyboard.press('Escape');

	await gotoDirectus(p, `/settings/flows/${ids.all}/${ids.log}`);
	await expect(drawer()).toBeVisible();
	titles.push(await title('.v-drawer .header-bar'));
	buttons['done'] = await controlState(drawer().getByRole('button', { name: 'check', exact: true }));

	const triggers: string[] = [];
	for (const id of ids.triggers) {
		await gotoDirectus(p, `/settings/flows/${id}`);
		await expect(dirTile(p, 'Trigger')).toBeVisible();
		triggers.push(
			(
				await p.evaluate(readPanels, {
					tile: '.v-workspace-tile',
					header: '.header .name',
					name: '.tile-content .name',
				})
			)[0]!,
		);
	}

	return { rows, titles, panels, triggers, buttons, sections };
}

async function backofficeFlowsUi(p: Page, ids: { all: string; log: string; triggers: string[] }): Promise<FlowsUi> {
	const h1 = async () =>
		p.locator('main h1').evaluate((el) => {
			const copy = el.cloneNode(true) as HTMLElement;
			copy.querySelectorAll('[data-icon], .sr-only, button').forEach((e) => e.remove());
			return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
		});
	const dialog = () => p.getByRole('dialog');
	const buttons: Record<string, string> = {};
	const read = { tile: '[data-panel-key]', header: ':scope > div > span.truncate', name: '[data-panel-title]' };

	await p.goto('/admin/settings/flows');
	await expect(p.locator('main tbody tr').first()).toBeVisible();
	const rows = await p.evaluate(readFlowRows, FIXTURE_FLOWS);
	const titles = [await h1()];
	buttons['createFlow'] = await controlState(p.getByRole('button', { name: 'Create Flow' }).first());

	await p.getByRole('button', { name: 'Create Flow' }).first().click();
	buttons['next'] = await controlState(p.getByRole('button', { name: 'Next' }));
	await dialog().getByRole('textbox', { name: /^Name/ }).fill('parity');
	await p.getByRole('button', { name: 'Next' }).click();
	buttons['finishSetup'] = await controlState(p.getByRole('button', { name: 'Finish Setup' }));
	await p.keyboard.press('Escape');
	await expect(dialog()).toHaveCount(0);

	await p.getByRole('button', { name: `Options for ${FLOWS.all}`, exact: true }).click();
	await p.getByRole('menuitem', { name: 'Edit Flow' }).click();
	titles.push(await dialog().locator('h2').first().innerText());
	buttons['saveDrawer'] = await controlState(dialog().getByRole('button', { name: 'Save', exact: true }));
	await p.keyboard.press('Escape');
	await expect(dialog()).toHaveCount(0);

	await p.goto(`/admin/settings/flows/${ids.all}`);
	await expect(panel(p, '$trigger')).toBeVisible();
	await p.waitForLoadState('networkidle');
	titles.push(await h1());
	const panels = await p.evaluate(readPanels, read);
	await openSidebar(p);
	const sections = (await p.locator('#sidebar h3').allTextContents())
		.map((t) => t.replace(/expand_more|[a-z_]+(?=[A-Z])/g, '').trim())
		.map(SECTIONS);
	buttons['editFlow'] = await controlState(p.getByRole('button', { name: 'Edit Flow' }));
	await p.getByRole('button', { name: 'Edit Flow' }).click();
	buttons['saveCanvas'] = await controlState(p.getByRole('button', { name: 'Save', exact: true }));
	buttons['clearChanges'] = await controlState(p.getByRole('button', { name: 'Clear Changes' }));
	await panel(p, 'log')
		.getByRole('button', { name: /^Options for/ })
		.click();
	buttons['copyTo'] = await controlState(p.getByRole('menuitem', { name: 'Copy To' }));
	await p.keyboard.press('Escape');

	await p.goto(`/admin/settings/flows/${ids.all}/${ids.log}`);
	await expect(dialog()).toBeVisible();
	titles.push(await dialog().locator('h2').first().innerText());
	buttons['done'] = await controlState(p.getByRole('button', { name: 'Done' }));

	const triggers: string[] = [];
	for (const id of ids.triggers) {
		await p.goto(`/admin/settings/flows/${id}`);
		await expect(panel(p, '$trigger')).toBeVisible();
		triggers.push((await p.evaluate(readPanels, read))[0]!);
	}

	return { rows, titles, panels, triggers, buttons, sections };
}

test('admin: flow table, bo_all_ops page, flow and operation drawers, 9 buttons and the Logs section match the Directus app (SC-004)', async ({
	page,
	browser,
}) => {
	test.setTimeout(300_000);
	const all = await flowId(api, FLOWS.all);
	const [log] = await api.call<{ id: string }[]>(
		'GET',
		`/operations?filter[flow][_eq]=${all}&filter[key][_eq]=log&fields=id`,
	);
	const ids = {
		all,
		log: log!.id,
		triggers: await Promise.all(OTHER_TRIGGERS.map((name) => flowId(api, name))),
	};

	const directus = await onDirectusApp(browser, (p) => directusFlowsUi(p, ids));

	await resetLastPage(api);
	await page.goto('/admin/login');
	await login(page, ADMIN);
	await expect(page).toHaveURL(/\/admin\/(?!login)/);
	const backoffice = await backofficeFlowsUi(page, ids);

	for (const key of Object.keys(directus) as (keyof FlowsUi)[])
		expect.soft(backoffice[key], key).toEqual(directus[key]);
});
