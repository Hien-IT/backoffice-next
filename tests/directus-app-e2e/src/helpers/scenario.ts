// Runs the same UI scenario through the reverse proxy (BASE_URL) and at Directus alone (DIRECTUS_URL), each in a
// fresh browser context, and returns the database changes of each run with the run tag replaced (SC-008).
import type { Browser, Page } from '@playwright/test';
import { dismissOwnerDialog } from './app.js';
import { changesSince, hostDb, snapshot } from './db-rows.js';
import { ADMIN, login } from './login.js';

export const DIRECTUS_URL = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';

/** Same-length tags so names written by both runs have the same length. */
const RUNS = [
	['prx', () => process.env['BASE_URL']!],
	['dir', () => DIRECTUS_URL],
] as const;

export async function bothRuns(
	browser: Browser,
	scenario: (page: Page, url: string, tag: string) => Promise<void>,
	/** User collections the scenario writes, compared like the system tables. */
	tables: string[] = [],
): Promise<Record<string, unknown>> {
	const out: Record<string, unknown> = {};
	const run = Date.now().toString(36);

	for (const [label, url] of RUNS) {
		const tag = `e2e-${run}-${label}`;
		const context = await browser.newContext();
		const page = await context.newPage();
		// The app opens last_page after signing in: start every run from the content module.
		await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
		// That update bypasses the response cache (CACHE_ENABLED=true) where /users/me may still hold the last page.
		await clearDataCache();
		const before = await snapshot(tables);

		try {
			await login(page, url());
			// What "Remind Later" of the owner reminder sets (the app removes it at each sign-in), so the reminder of an
			// admin without project owner stays closed on the next pages.
			await context.addCookies([{ name: 'license-banner-dismissed', value: 'true', url: url() }]);
			await dismissOwnerDialog(page);
			await scenario(page, url(), tag);
			await page.waitForLoadState('networkidle');
		} finally {
			await context.close();
		}

		out[label] = JSON.parse(
			JSON.stringify(await changesSince(before, tables))
				.split(tag)
				.join('e2e-<run>'),
		);
	}

	return out;
}

async function clearDataCache(): Promise<void> {
	const login = await fetch(`${DIRECTUS_URL}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(ADMIN),
	});
	const token = ((await login.json()) as any).data.access_token as string;
	await fetch(`${DIRECTUS_URL}/utils/cache/clear`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
}
