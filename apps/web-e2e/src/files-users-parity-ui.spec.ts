// Feature 015 US7 (T095, SC-002, CHK060): the same Files and Users screens in the Directus app (DIRECTUS_URL/admin) and in
// the new app show the same (a) sub-menu labels in order, (b) title and breadcrumb, (c) count line, (d) state of the
// header buttons (create folder, upload/create, invite, delete, move, download, edit image, save, archive: on, off or
// absent) and (e) detail-panel sections, for the admin, bo-editor and bo-viewer. Runs in E2E_CONFIG=proxy-api only and
// drives the Directus app, so chromium-1280 only (DIRECTUS_APP_SPECS). Left out: the Directus-only "AI Assistant"
// section (D-41) and back arrow; a user page the user cannot read shows the module not-found page in the new app and
// the "Adding User" form in the Directus app (FR-054, CHK047), so that screen is compared for the admin only.
import type { Page } from '@playwright/test';
import { AdminApi } from './helpers/api.js';
import { ADMIN, e2eConfig } from './helpers/config.js';
import { goto as gotoDirectus, onDirectusApp } from './helpers/directus-app.js';
import { openSidebar } from './helpers/content.js';
import { moduleBar } from './helpers/layout.js';
import { login, resetLastPage } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'compares with the Directus app of the main pair (proxy-api only)');
test.use({ actionTimeout: 15_000 });

// Test values of the fixture users, from apps/web/fixtures/interfaces/lib.mjs (USERS).
const EDITOR = { email: 'bo-editor@example.com', password: 'bo-editor-test-password' };
const VIEWER = { email: 'bo-viewer@example.com', password: 'bo-viewer-test-password' };

/** Header buttons compared, by icon; the Directus move button is a custom SVG. */
const ICONS = ['create_new_folder', 'add', 'person_add', 'delete', 'folder_move', 'download', 'tune', 'archive', 'check'];

type Screen = { nav: string[]; title: string; crumbs: string[]; count: string; buttons: string[]; sections: string[] };

const COUNT = /^(No|One|\d[\d,.]*) Items?/;

let api: AdminApi;
let paths: Record<string, string>;
let childRoles: string[];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const one = async (path: string) => (await api.call<{ id: string }[]>('GET', path))[0]!.id;
	paths = {
		library: '/files',
		folder: `/files/folders/${await one('/folders?fields=id&filter[name][_eq]=bo-files-sub')}`,
		file: `/files/${await one('/files?fields=id&filter[title][_eq]=bo-edit')}`,
		directory: '/users',
		role: `/users/roles/${await one('/roles?fields=id&filter[name][_eq]=bo-editor')}`,
		user: `/users/${await one('/users?fields=id&filter[email][_eq]=bo-active@example.com')}`,
	};
	childRoles = (await api.call<{ name: string }[]>('GET', '/roles?fields=name&filter[parent][_nnull]=true')).map((r) => r.name);
});

test.afterAll(async () => {
	await resetLastPage(api);
});

async function directusScreen(page: Page, path: string): Promise<Screen> {
	await gotoDirectus(page, path);
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(800);

	return page.evaluate(
		({ icons, count }) => {
			const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
			const buttons: string[] = [];

			for (const wrapper of Array.from(document.querySelectorAll('header .v-button'))) {
				const icon = wrapper.querySelector('[data-icon]')?.getAttribute('data-icon') ?? (wrapper.querySelector('svg.custom-icon-svg') ? 'folder_move' : '');
				if (!icons.includes(icon)) continue;
				const control = wrapper.querySelector('button, a');
				const off = control?.hasAttribute('disabled') && control.getAttribute('disabled') !== 'false';
				buttons.push(`${icon}:${off ? 'off' : 'on'}`);
			}

			return {
				nav: Array.from(document.querySelectorAll('.module-nav .v-list-item, #navigation .v-list-item')).map((i) =>
					text(i.querySelector('.v-list-item-content, .v-text-overflow') ?? i),
				),
				title: text(document.querySelector('header .title, header h1')),
				// D-101 of 016: the new app shows no breadcrumb (owner, 2026-10-17); its crumbs must be empty.
				crumbs: [] as string[],
				count: new RegExp(count).exec(text(document.querySelector('.item-count')))?.[0] ?? '',
				buttons: buttons.sort(),
				sections: Array.from(document.querySelectorAll('#sidebar .accordion-trigger, #sidebar .collapsible-trigger, .sidebar-detail-header .title'))
					.map(text)
					.filter((t) => t && t !== 'AI Assistant')
					// A count badge comes before the name in the Directus DOM ("1Revisions"): "Revisions 1".
					.map((t) => `${t.replace(/\d+/g, '').trim()} ${t.replace(/\D+/g, '')}`.trim()),
			};
		},
		{ icons: ICONS, count: COUNT.source },
	);
}

async function backofficeScreen(page: Page, path: string): Promise<Screen> {
	await page.goto(`/admin${path}`);
	// Attached, not visible: a role the user cannot read leaves the title empty (as in the Directus app).
	await expect(page.locator('main h1')).toBeAttached({ timeout: 15_000 });
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(800);

	const main = await page.evaluate(
		({ icons, count }) => {
			const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
			// The row or button text without icon ligatures and screen-reader texts.
			const label = (el: Element) => {
				const copy = el.cloneNode(true) as HTMLElement;
				copy.querySelectorAll('[data-icon], .sr-only, button').forEach((e) => e.remove());
				return text(copy);
			};
			const h1 = document.querySelector('main h1');
			const header = h1?.closest('.mb-6');
			const actions = header?.lastElementChild;
			const buttons: string[] = [];

			for (const control of Array.from(actions?.querySelectorAll('button, a') ?? [])) {
				// BoIcon carries its name in `data-icon` like Directus v-icon (custom SVG icons such as folder_move have no ligature).
				const icon = control.querySelector('[data-icon]')?.getAttribute('data-icon') ?? '';
				if (!icons.includes(icon)) continue;
				const off = (control as HTMLButtonElement).disabled || control.getAttribute('aria-disabled') === 'true';
				buttons.push(`${icon}:${off ? 'off' : 'on'}`);
			}

			const status = Array.from(document.querySelectorAll('main [role="status"]')).map(text).find((t) => new RegExp(count).test(t));

			return {
				title: text(h1),
				crumbs: Array.from(header?.querySelectorAll('nav[aria-label="Breadcrumb"] a') ?? []).map(label),
				count: status ? new RegExp(count).exec(status)![0] : '',
				buttons: buttons.sort(),
			};
		},
		{ icons: ICONS, count: COUNT.source },
	);

	// Below `xl` the navigation is a drawer; chromium-1280 is at `xl`, the module bar holds the sub-menu.
	const bar = await moduleBar(page);
	const nav = await bar.evaluate((root) => {
		const sub = root.querySelector('nav[aria-label="File Library"], nav[aria-label="User Directory"]');
		const rows = sub ? Array.from(sub.querySelectorAll('[role="treeitem"] [data-tree-row], ul > li > a')) : [];
		return rows.map((row) => {
			const copy = row.cloneNode(true) as HTMLElement;
			copy.querySelectorAll('[data-icon], .sr-only, button').forEach((e) => e.remove());
			return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
		});
	});

	await openSidebar(page);
	const sections = (await page.locator('#sidebar h3').allTextContents())
		.map((t) => t.replace(/expand_more|[a-z_]+(?=[A-Z])/g, '').trim())
		.map((t) => `${t.replace(/\d+/g, '').trim()} ${t.replace(/\D+/g, '')}`.trim());

	return { ...main, nav, sections };
}

const SCREENS = ['library', 'folder', 'file', 'directory', 'role', 'user'] as const;

for (const [name, user] of [
	['admin', ADMIN],
	['bo-editor', EDITOR],
	['bo-viewer', VIEWER],
] as const) {
	test(`${name}: sub-menu, title, breadcrumb, count, buttons and panel sections match the Directus app (SC-002)`, async ({
		page,
		browser,
	}) => {
		const screens = SCREENS.filter((screen) => screen !== 'user' || name === 'admin');
		// Sign-in lands on last_page: the Directus run resets it for this user (by id) first.
		const id =
			name === 'admin'
				? undefined
				: (await api.call<{ id: string }[]>('GET', `/users?fields=id&filter[email][_eq]=${user.email}`))[0]!.id;
		const signIn = id ? { ...user, id } : user;

		const directus = await onDirectusApp(
			browser,
			async (p) => {
				const out: Partial<Record<(typeof SCREENS)[number], Screen>> = {};
				for (const screen of screens) out[screen] = await directusScreen(p, paths[screen]!);
				return out;
			},
			signIn,
		);

		await resetLastPage(api);
		if (id) await api.call('PATCH', `/users/${id}`, { data: { last_page: null } });
		await page.goto('/admin/login');
		await login(page, user);
		await expect(page).toHaveURL(/\/admin\/(?!login)/);

		for (const screen of screens) {
			const backoffice = await backofficeScreen(page, paths[screen]!);
			// On a user page the Directus app opens the role tree to the user's role only when the user answers before
			// /roles (use-navigation pushes into the array VItemGroup does not watch): the child roles are left out there.
			const drop = (shown: Screen) =>
				screen === 'user' ? { ...shown, nav: shown.nav.filter((row) => !childRoles.includes(row)) } : shown;
			expect.soft(drop(backoffice), `${name} ${screen}`).toEqual(drop(directus[screen]!));
		}
	});
}
