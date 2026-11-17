// Spec 033 (FR-034..FR-037, research R10): the helpers of the screenshot scripts of the documentation area. Run by hand
// (`docs:shots`, project docs-shots); the pictures are written to apps/web/src/docs/content/images and committed.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { ADMIN } from '../helpers/config.js';
import { login, resetLastPage } from '../helpers/login.js';
import { LOCALE } from './lang.js';
import { seed, type Seeded } from './seed.js';

// Masked areas (dates, ids, URLs) are painted in the gray-200 of the theme, like an empty field.
const MASK_COLOR = '#e4e7ec';

const SETTLE = `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
	.material-symbols-rounded { font-display: block; }`;

/**
 * A screenshot of the page (or of one element) into the images folder (`snapshotPathTemplate` of the docs-shots
 * project), after fonts and transitions settled. The committed picture is kept when the screen matches it within the
 * anti-aliasing tolerance, rewritten otherwise.
 */
export async function shot(page: Page, name: string, options: { mask?: Locator[]; of?: Locator } = {}): Promise<void> {
	await page.addStyleTag({ content: SETTLE });
	await page.evaluate(async () => {
		await document.fonts.ready;
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	});
	await page.waitForTimeout(400);

	await expect(options.of ?? page).toHaveScreenshot(`${name}.png`, {
		animations: 'disabled',
		caret: 'hide',
		mask: options.mask ?? [],
		maskColor: MASK_COLOR,
		// shortcut: a change smaller than this many pixels (a few letters) keeps the old picture; rerun with
		// `--update-snapshots=all` after such a change.
		maxDiffPixels: 0,
	});
}

interface Fixtures {
	api: AdminApi;
	data: Seeded;
}

/**
 * `test` of the screenshot scripts: the sample data (seed.ts, created once and reused) and an admin signed in with
 * the language of the run (lang.ts). The admin's language and last page are put back after each test.
 */
export const test = base.extend<{ signedIn: Page }, Fixtures>({
	api: [
		async ({ playwright }, use) => {
			const context = await playwright.request.newContext();
			await use(new AdminApi(context));
			await context.dispose();
		},
		{ scope: 'worker' },
	],
	data: [async ({ api }, use) => use(await seed(api)), { scope: 'worker' }],
	// `data` first: on a new database a script that shows the sample data without asking for it still finds it.
	signedIn: async ({ page, api, data: _data }, use) => {
		const { language } = await api.call<{ language: string | null }>('GET', '/users/me?fields=language');
		await api.call('PATCH', '/users/me', { data: { language: LOCALE, theme_light: null, appearance: 'light' } });
		await resetLastPage(api);

		await page.goto('/admin/login');
		await login(page, ADMIN);
		await expect(page).toHaveURL(/\/admin\/content/);

		await use(page);

		await api.call('PATCH', '/users/me', { data: { language } });
		await resetLastPage(api);
	},
});

export { expect };

/** The page title of the shell, once the page loaded. */
export async function ready(page: Page, path: string): Promise<void> {
	await page.goto(`/admin${path}`);
	await expect(page.locator('#main-content h1').first()).toBeVisible({ timeout: 20_000 });
	await page.waitForLoadState('networkidle');
}

/** The card (TailAdmin Card, `rounded-2xl`) under a third-level heading of the page. */
export function card(page: Page, title: string): Locator {
	return page
		.locator('h3', { hasText: title })
		.first()
		.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]');
}
