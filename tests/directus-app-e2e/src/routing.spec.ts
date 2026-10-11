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
