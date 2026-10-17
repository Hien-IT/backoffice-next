// Copied from tests/directus-app-e2e/src/helpers/{app,login}.ts and scenario.ts (feature 004); not synced, keep changes
// in both. Feature 014 US7 (T087, contracts/tests.md §4): drives the Directus app 11.17.4 (DIRECTUS_URL/admin) for the
// payload specs (src/payload/*.spec.ts), one fresh browser context per run, and adds one helper per scenario group
// (filters, versions, comments, shares). Icon buttons of the Directus app are named by their Material Symbols ligature.
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { ADMIN, directusUrl } from './config.js';

/** Who signs in: the admin, or a fixture user (`id` set) so per-user rows like presets stay apart from other specs. */
export interface SignIn {
	email: string;
	password: string;
	id?: string;
}

/** Directus asks an admin without a project owner to set one: "Remind Later" closes it without accepting anything. */
export async function dismissOwnerDialog(page: Page): Promise<void> {
	const later = page.getByRole('button', { name: 'Remind Later' });
	if (await later.isVisible().catch(() => false)) await later.click({ timeout: 5_000 }).catch(() => undefined);
}

/** The `.field` of a form whose label is `label`. */
export function field(page: Page | Locator, label: string): Locator {
	// `has` is matched inside each `.field`: build it from the page, not from a scoped locator.
	const root = 'goto' in page ? page : page.page();
	return page.locator('.field').filter({ has: root.locator('.field-label', { hasText: new RegExp(`^${label}`) }) });
}

/** A header-bar button, named by its icon (`check`, `more_vert`, `delete`, `archive`...). */
export function headerButton(page: Page, icon: string): Locator {
	return page.getByRole('banner').getByRole('button', { name: icon, exact: true });
}

/** The confirmation card of a v-dialog (the Directus app gives it no dialog role). */
export function card(page: Page): Locator {
	return page.locator('.v-card').last();
}

/** An admin call to Directus (JSON mode), outside the browser. */
export async function directusApi(method: string, path: string, body?: unknown): Promise<any> {
	const login = await fetch(`${directusUrl}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;
	const response = await fetch(`${directusUrl}${path}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
	const text = await response.text();
	return text ? JSON.parse(text).data : undefined;
}

/**
 * Signs in to the Directus app in a fresh context and runs `steps` there. Like `bothRuns`: the app opens last_page after
 * signing in, so it is set to null first, and the data cache (CACHE_ENABLED) is cleared so /users/me does not still
 * hold it.
 */
export async function onDirectusApp<T>(
	browser: Browser,
	steps: (page: Page) => Promise<T>,
	user: SignIn = ADMIN,
): Promise<T> {
	await directusApi('PATCH', user.id ? `/users/${user.id}` : '/users/me', { last_page: null });
	await directusApi('POST', '/utils/cache/clear');
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();

	try {
		await page.goto(`${directusUrl}/admin/login`);
		await page.locator('input[type="email"]').fill(user.email);
		await page.locator('input[type="password"]').fill(user.password);
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL(/\/admin\/content/, { timeout: 30_000 });
		// What "Remind Later" of the owner reminder sets, so the reminder stays closed on the next pages.
		await context.addCookies([{ name: 'license-banner-dismissed', value: 'true', url: directusUrl }]);
		await dismissOwnerDialog(page);
		return await steps(page);
	} finally {
		await context.close();
	}
}

/** Opens a page of the Directus app and waits for its main area. */
export async function goto(page: Page, path: string): Promise<void> {
	await page.goto(`${directusUrl}/admin${path}`);
	await expect(page.getByRole('main').first()).toBeVisible({ timeout: 15_000 });
	await dismissOwnerDialog(page);
}

/** The module sidebar (Layout Options, Revisions, Comments, Shares... sections). */
export function sidebar(page: Page): Locator {
	return page.getByRole('contentinfo', { name: 'Module Sidebar' });
}

/** Picks `option` in the menu a v-select or v-menu activator just opened. */
export async function chooseInMenu(page: Page, option: string | RegExp): Promise<void> {
	await page
		.locator('.v-menu-content')
		.last()
		.getByText(option, { exact: typeof option === 'string' })
		.click();
}

/** Opens a sidebar section by its title (`Layout Options`, `Comments`, `Shares`...) when it is closed. */
export async function openSidebarSection(page: Page, title: string): Promise<void> {
	const button = sidebar(page).getByRole('button', { name: new RegExp(`${title} chevron_left$`) });
	if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

/** Sets a select of the layout options (`Layout`, `Start Date Field`, `Card Title`...). */
export async function layoutOption(page: Page, label: string, option: string): Promise<void> {
	await openSidebarSection(page, 'Layout Options');
	await sidebar(page)
		.locator('.field')
		.filter({ has: page.locator('.type-label', { hasText: new RegExp(`^${label}$`) }) })
		.locator('.v-input')
		.first()
		.click();
	await chooseInMenu(page, option);
}

// Filters: the inline system filter of the search bar (`filter_list`), rendered from the preset filter.

/** Opens the filter of the collection page; returns its tree. */
export async function openFilter(page: Page): Promise<Locator> {
	await headerButton(page, 'filter_list').click();
	const filter = page.locator('.system-filter').first();
	await expect(filter).toBeVisible();
	return filter;
}

// Versions: the version menu of the item header (`published_with_changes <version> arrow_drop_down`).

/** Opens the version menu and picks `entry` (a version name, `Create Version`, `Promote Version`...). */
export async function versionMenu(page: Page, entry: string | RegExp): Promise<void> {
	await page
		.getByRole('banner')
		.getByRole('button', { name: /arrow_drop_down$/ })
		.click();
	await chooseInMenu(page, entry);
}

// Comments: the sidebar Comments section (a contenteditable with `@` mentions).

/** Writes a comment `text`, then `@<mention>` picked in the user menu, and submits it. */
export async function postComment(page: Page, text: string, mention: string): Promise<void> {
	await openSidebarSection(page, 'Comments');
	await sidebar(page).locator('[contenteditable]').first().click();
	await page.keyboard.type(`${text} @${mention.slice(0, 3)}`);
	await chooseInMenu(page, new RegExp(mention));
	await sidebar(page).getByRole('button', { name: 'Submit' }).click();
}

/** Opens the `more_horiz` menu of the first comment or share of the open sidebar section and picks `entry`. */
export async function sidebarItemMenu(page: Page, entry: string | RegExp): Promise<void> {
	await sidebar(page).getByRole('button', { name: 'more_horiz' }).first().click();
	await chooseInMenu(page, entry);
}

// Shares: the sidebar Shares section; the share form opens in a drawer.

/** The share drawer's field `label` input. */
export function shareField(page: Page, label: string): Locator {
	return field(page.locator('.v-drawer').last(), label).locator('input');
}

/** Saves the share drawer. */
export async function saveShare(page: Page): Promise<void> {
	await page.locator('.v-drawer').last().getByRole('button', { name: 'check', exact: true }).click();
	await expect(page.locator('.v-drawer')).toHaveCount(0);
}

// Flows (feature 017, contracts/components.md §6): the canvas of the Directus app, a `.v-workspace-tile` per panel with
// its cell in `--pos-x/--pos-y`, handles `.add-resolve`/`.add-reject`/`.attachment`, and the arrows of `.arrows`.

const GRID = 18;

/** The canvas tile whose header names `name` (the operation name, or `Trigger`). */
export function dirTile(page: Page, name: string): Locator {
	return page
		.locator('.v-workspace-tile')
		.filter({ has: page.locator('.header .name', { hasText: new RegExp(`^${name}$`) }) });
}

/** Opens a flow page of the Directus app and waits for its trigger tile. */
export async function openDirectusFlow(page: Page, id: string): Promise<void> {
	await goto(page, `/settings/flows/${id}`);
	await expect(dirTile(page, 'Trigger')).toBeVisible({ timeout: 15_000 });
}

/** `{ name, x, y }` of every tile, from `--pos-x/--pos-y` (the cells the Backoffice app exposes as `data-pos-*`). */
export async function readDirectusGrid(page: Page): Promise<{ name: string; x: number; y: number }[]> {
	return page.locator('.v-workspace-tile').evaluateAll((tiles) =>
		tiles
			.map((tile) => {
				const style = (tile as HTMLElement).style;
				return {
					name: tile.querySelector('.header .name')?.textContent?.trim() ?? '',
					x: Number(style.getPropertyValue('--pos-x')),
					y: Number(style.getPropertyValue('--pos-y')),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name) || a.x - b.x || a.y - b.y),
	);
}

/** The drawn arrows (the hint arrow of the hovered handle left out) by branch. */
export async function countDirectusArrows(page: Page): Promise<{ resolve: number; reject: number }> {
	const count = (type: string) => page.locator(`.arrows path.${type}:not(.hint)`).count();
	return { resolve: await count('resolve'), reject: await count('reject') };
}

/** Clicks a handle (`.add-resolve`, `.add-reject`) of `from`, picks `type` in the operation drawer, Done. */
export async function dirAddOperation(page: Page, from: Locator, handle: string, type: string): Promise<void> {
	await from.scrollIntoViewIfNeeded();
	await from.hover();
	await from.locator(handle).click();
	const drawer = page.locator('.v-drawer').last();
	await drawer
		.locator('.v-fancy-select-option', { hasText: new RegExp(`^\\s*\\S*\\s*${type}`) })
		.first()
		.click();
	await drawer.getByRole('button', { name: 'check', exact: true }).click();
	await expect(page.locator('.v-drawer')).toHaveCount(0);
}

/** Moves the mouse from the centre of `from` by `to` (px) in small steps (the canvas reads pointermove in rAF/throttle). */
export async function dirDrag(page: Page, from: Locator, to: { x: number; y: number }): Promise<void> {
	await from.scrollIntoViewIfNeeded();
	const box = (await from.boundingBox())!;
	const start = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 10) };
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	for (let i = 1; i <= 10; i++) {
		await page.mouse.move(start.x + (to.x * i) / 10, start.y + (to.y * i) / 10);
		await page.waitForTimeout(40);
	}
	// The canvas reads pointermove in requestAnimationFrame and pointerup cancels the pending frame: let the last
	// position land first (CI 39018596094, payload (3)).
	await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
	await page.mouse.up();
	await page.waitForTimeout(200);
}

/** Drags a tile by its header by whole cells. */
export async function dirDragTile(page: Page, name: string, cells: { dx: number; dy: number }): Promise<void> {
	await dirDrag(page, dirTile(page, name).locator('.header'), { x: cells.dx * GRID, y: cells.dy * GRID });
}

/**
 * Drags the `.add-resolve`/`.add-reject` handle of `from` onto the input of `to`, or 20 cells down (detach). The Directus
 * app places the drop at `pageX - rect.left` (page minus viewport coordinates, `operation.vue`): with the window
 * scrolled, the aim is short by the scroll. Returns what the drag used, for a failure message.
 */
export async function dirLink(page: Page, from: string, handle: string, to: string | null): Promise<string> {
	const source = dirTile(page, from).locator(handle);
	if (!to) {
		await dirDrag(page, source, { x: 0, y: 20 * GRID });
		return 'detach';
	}
	await source.scrollIntoViewIfNeeded();
	const a = (await source.boundingBox())!;
	const b = (await dirTile(page, to).locator('.attachment').boundingBox())!;
	const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
	const delta = {
		x: b.x + b.width / 2 - (a.x + a.width / 2) - scroll.x,
		y: b.y + b.height / 2 - (a.y + Math.min(a.height / 2, 10)) - scroll.y,
	};
	await dirDrag(page, source, delta);
	return JSON.stringify({ source: a, target: b, scroll, delta, viewport: page.viewportSize() });
}

/** Opens the menu of a tile in edit mode and picks `entry` (`Duplicate`, `Delete`, `Copy To...`). */
export async function dirTileMenu(page: Page, tile: Locator, entry: string): Promise<void> {
	await tile.scrollIntoViewIfNeeded();
	await tile.locator('.edit-actions .more-icon').click();
	await chooseInMenu(page, entry);
}

/** Saves the flow page (header `check`) and waits for view mode. */
export async function dirSaveFlow(page: Page): Promise<void> {
	await headerButton(page, 'check').click();
	await expect(headerButton(page, 'edit')).toBeVisible({ timeout: 30_000 });
}
