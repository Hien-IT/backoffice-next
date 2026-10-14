// FR-067 (T065): WCAG 2.1 AA on the screens of the feature, light and dark, and the main flow by keyboard only.
// Color contrast of the token pairs listed in spec Q-8 is a known exception until the design owner answers; any other
// serious or critical violation, low contrast of other pairs included, fails.
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { ADMIN } from './helpers/config.js';
import { closeHostDb, hostDb } from './helpers/db-rows.js';
import { login } from './helpers/login.js';
import { expect, test } from './helpers/requests.js';

test.afterAll(closeHostDb);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Q-8 (spec): token pairs measured below AA on 2026-10-14, a known exception until the design owner answers.
// Foreground on background as axe reports them; any other low-contrast pair fails.
const Q8_PAIRS = new Set([
	'#7384a4 on #ffffff', // text-secondary on surface-default
	'#7384a4 on #f5f5f6', // text-secondary on surface-subtle
	'#ffffff on #1890ff', // text on action-primary (primary button)
	'#1890ff on #ffffff', // link (action-primary) on surface-default
]);

const pair = (data: unknown) => {
	const { fgColor, bgColor } = (data ?? {}) as { fgColor?: string; bgColor?: string };
	return `${fgColor} on ${bgColor}`;
};

async function violations(page: Page) {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => ({
			id: v.id,
			nodes: v.id === 'color-contrast' ? v.nodes.filter((n) => !Q8_PAIRS.has(pair(n.any[0]?.data))) : v.nodes,
		}))
		.filter((v) => v.nodes.length > 0)
		.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const PUBLIC = ['/admin/login', '/admin/reset-password', '/admin/accept-invite?token=x', '/admin/register'];
const PRIVATE = ['/admin/content', '/admin/users/me', '/admin/files/not-there', '/admin/khong-co'];

for (const scheme of ['light', 'dark'] as const) {
	test(`public and private screens have no serious violations (${scheme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme });
		const found: Record<string, string[]> = {};

		for (const path of PUBLIC) {
			await page.goto(path);
			await expect(page.locator('h1').first()).toBeVisible();
			found[path] = await violations(page);
		}

		await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
		await page.goto('/admin/login');
		await login(page, ADMIN);
		await expect(page).toHaveURL(/\/admin\/content$/);

		for (const path of PRIVATE) {
			await page.goto(path);
			await expect(page.locator('h1').first()).toBeVisible();
			found[path] = await violations(page);
		}

		expect(Object.fromEntries(Object.entries(found).filter(([, v]) => v.length))).toEqual({});
	});
}

test('keyboard only: sign in, open Files, open and close the avatar menu, sign out (FR-027, FR-067)', async ({
	page,
}) => {
	test.skip(
		page.viewportSize()!.width < 922,
		'below lg the module bar sits in the navigation drawer (navigation.spec)',
	);
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
	await page.goto('/admin/login');
	await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();

	const focused = () =>
		page.evaluate(() => document.activeElement?.getAttribute('name') ?? document.activeElement?.textContent?.trim());

	const tabTo = async (predicate: () => Promise<boolean>, max = 30) => {
		for (let i = 0; i < max; i++) {
			if (await predicate()) return;
			await page.keyboard.press('Tab');
		}
		throw new Error('focus never reached the target');
	};

	await tabTo(async () => (await focused()) === 'email');
	await page.keyboard.type(ADMIN.email);
	await page.keyboard.press('Tab');
	expect(await focused()).toBe('password');
	await page.keyboard.type(ADMIN.password);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/admin\/content$/);

	const files = page.getByTestId('module-bar').locator('a[href="/admin/files"]');
	await tabTo(() => files.evaluate((el) => el === document.activeElement));
	expect(await files.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/admin\/files$/);

	const avatar = page.getByRole('button', { name: /Admin|User/ }).last();
	await tabTo(() => avatar.evaluate((el) => el === document.activeElement));
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menuitem').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(avatar).toBeFocused();

	await page.keyboard.press('Enter');
	await page.getByRole('menuitem', { name: 'Sign Out' }).focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/reason=SIGN_OUT/);
});
