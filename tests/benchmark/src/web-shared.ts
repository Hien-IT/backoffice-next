// Spec 020 (T149): what the web benchmarks share: the parity env values, the sign-in of a browser context to a web app
// (the Directus app or the Backoffice web app), the nearest-rank p95 and the most frequent request split.
import { readFileSync } from 'node:fs';
import type { Browser, BrowserContext } from '@playwright/test';

const env = readFileSync(new URL('../../parity/env/postgres.env', import.meta.url), 'utf8');
export const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
export const TIMEOUT = 120_000;

export async function signIn(browser: Browser, baseURL: string): Promise<BrowserContext> {
	const context = await browser.newContext({
		baseURL,
		viewport: { width: 1440, height: 900 },
		extraHTTPHeaders: { 'cache-control': 'no-store' },
	});
	// The Directus app asks an admin without a project owner to set one (a dialog over the page): the cookie its
	// "Remind Later" sets keeps it closed (as apps/web-e2e/src/helpers/directus-app.ts).
	await context.addCookies([{ name: 'license-banner-dismissed', value: 'true', url: baseURL }]);
	const page = await context.newPage();
	await page.goto('/admin/login');
	// Label in the new app, placeholder in the Directus app (en-US strings of both).
	const field = (name: string) =>
		page.getByLabel(name, { exact: true }).or(page.getByPlaceholder(name, { exact: true }));
	await field('Email').fill(envValue('ADMIN_EMAIL'));
	await field('Password').fill(envValue('ADMIN_PASSWORD'));
	await page.getByRole('button', { name: 'Sign In', exact: true }).click();
	await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: TIMEOUT });
	const later = page.getByRole('button', { name: 'Remind Later' });
	await later
		.waitFor({ timeout: 3_000 })
		.then(() => later.click())
		.catch(() => undefined);
	await page.close();
	return context;
}

/** Nearest-rank p95 (with 11 runs: the slowest). */
export function p95(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return Math.round(sorted[Math.ceil(0.95 * sorted.length) - 1]!);
}

/** The request split seen in most runs. */
export function usual(values: string[]): string {
	const counts = new Map<string, number>();
	for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
}
