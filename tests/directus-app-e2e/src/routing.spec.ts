// Feature 004 (FR-106, T075): after the app loads through the proxy, every request to a route of the list went to the
// new app and every other one to Directus (nginx log with $upstream_addr). Routes the app calls that are not in
// contracts/proxy-e2e.md §1 are written to the test output for tasks.md.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { dismissOwnerDialog } from './helpers/app.js';
import { hostDb, closeHostDb } from './helpers/db-rows.js';
import { ADMIN, login } from './helpers/login.js';

test.beforeEach(async () => {
	await hostDb()('directus_users').where({ email: ADMIN.email }).update({ last_page: null });
});

test.afterAll(closeHostDb);
import { containerAddress, proxyLog, upstreamOf } from './helpers/proxy-log.js';

const routes = readFileSync(new URL('../../parity/proxy/backoffice-routes.txt', import.meta.url), 'utf8')
	.split('\n')
	.map((l) => l.replace(/#.*/, '').trim())
	.filter(Boolean);

test('requests of the route list reach the new app, the others Directus', async ({ page, baseURL }) => {
	const since = new Date().toISOString();

	await login(page, baseURL!);
	await dismissOwnerDialog(page);
	await page.goto(`${baseURL}/admin/users`);
	await page.goto(`${baseURL}/admin/settings/roles`);
	await page.goto(`${baseURL}/admin/settings/policies`);
	// Feature 007: the file library loads /files, /folders and the thumbnails of /assets.
	await page.goto(`${baseURL}/admin/files`);
	// Feature 008: the activity module loads /activity; feature 010 adds /notifications (bell) to the new app.
	await page.goto(`${baseURL}/admin/activity`);
	// Feature 009: every page of the app loads /flows (stores/flows.ts); Settings > Flows reads it again.
	await page.goto(`${baseURL}/admin/settings/flows`);
	// Feature 010: every page loads /settings, /presets, /notifications, /translations (stores); Settings > Project
	// reads /settings again, Insights /dashboards and /panels, Settings > Translations /translations.
	await page.goto(`${baseURL}/admin/settings/project`);
	await page.goto(`${baseURL}/admin/insights`);
	await page.goto(`${baseURL}/admin/settings/translations`);
	await page.waitForLoadState('networkidle');

	const addresses = {
		directus: containerAddress('parity-postgres-directus-1'),
		backoffice: containerAddress('parity-postgres-backoffice-api-1'),
	};

	const entries = proxyLog(since);
	expect(entries.length).toBeGreaterThan(0);

	const wrong = entries.filter((entry) => {
		const segment = entry.path.split('?')[0]!.split('/')[1] ?? '';
		const expected = routes.includes(segment) ? 'backoffice' : 'directus';
		return upstreamOf(entry, addresses) !== expected;
	});

	expect(wrong).toEqual([]);

	const toBackoffice = [
		...new Set(
			entries
				.filter((e) => upstreamOf(e, addresses) === 'backoffice')
				.map((e) => `${e.method} ${e.path.split('?')[0]}`),
		),
	];
	process.stdout.write(`routes answered by the new app:\n${toBackoffice.sort().join('\n')}\n`);
});

// Feature 005 (T047): the content module and the CSV export (window.open of ?export=csv&access_token=...) go to the
// new app.
test('/items requests, the CSV export with access_token included, reach the new app', async ({ page, baseURL }) => {
	const collection = 'e2e_routing_items';
	const auth = async () => {
		const res = await fetch(`${baseURL}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(ADMIN),
		});
		return ((await res.json()) as any).data.access_token as string;
	};
	const token = await auth();
	const api = (method: string, path: string, body?: unknown) =>
		fetch(`${baseURL}${path}`, {
			method,
			headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});

	await api('DELETE', `/collections/${collection}`);
	await api('POST', '/collections', {
		collection,
		schema: {},
		meta: {},
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string' },
		],
	});

	try {
		const since = new Date().toISOString();
		await login(page, baseURL!);
		await dismissOwnerDialog(page);
		await page.goto(`${baseURL}/admin/content/${collection}`);
		await page.waitForLoadState('networkidle');

		const exported = await fetch(`${baseURL}/items/${collection}?export=csv&limit=-1&access_token=${token}`);
		expect(exported.status).toBe(200);
		expect(exported.headers.get('content-disposition')).toMatch(new RegExp(`^attachment; filename="${collection} `));

		const addresses = {
			directus: containerAddress('parity-postgres-directus-1'),
			backoffice: containerAddress('parity-postgres-backoffice-api-1'),
		};
		const items = proxyLog(since).filter((e) => e.path.startsWith('/items/'));

		expect(items.some((e) => e.path.includes('export=csv'))).toBe(true);
		expect(items.filter((e) => upstreamOf(e, addresses) !== 'backoffice')).toEqual([]);
	} finally {
		await api('DELETE', `/collections/${collection}`);
	}
});
