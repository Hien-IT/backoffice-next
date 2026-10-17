// Feature 018 T111 (SC-005, FR-101, contracts/tests.md §4, data-model §10, api-calls #196–#203): the notifications
// drawer sends the requests of the Directus app 11.17.4. A temporary user (role with the minimal app permissions plus
// `delete` on its own notifications, like notifications.spec) gets 27 notifications before each run (two pages of 25);
// on both apps the same steps record the requests to /notifications: open the drawer, page 2, the Archive and Inbox
// tabs, Archive one row, Unarchive it, Delete another after confirming (with the unread count), page 2, a search. After the
// writes the rows of directus_notifications (db-rows.ts NOTIFICATIONS_TABLES, `scopeChanges`) are compared too. The
// notifications of the Directus run are named `<prefix>-dir-pn-NN`, those of the Backoffice run `<prefix>-bo-pn-NN`;
// the user (and its notifications) is deleted after the file. proxy-api only.
import type { Locator, Page, Request } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { changesSince, closeHostDb, NOTIFICATIONS_TABLES, scopeChanges, snapshot } from '../helpers/db-rows.js';
import { card, onDirectusApp, openDirectusNotifications } from '../helpers/directus-app.js';
import { Fixtures, type TestUser } from '../helpers/fixtures.js';
import { canonicalPath, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { apiPath, expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });
test.setTimeout(240_000);

type Run = keyof typeof RUN_TAG;
const COUNT = 27;
const subject = (run: Run, n: number) => `${RUN_TAG[run]}-pn-${String(n).padStart(2, '0')}`;

let api: AdminApi;
let fixtures: Fixtures;
let user: TestUser;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	fixtures = new Fixtures(api);
	const role = await fixtures.role('payload notifications');
	const [access] = await api.call<{ policy: string }[]>('GET', `/access?filter[role][_eq]=${role}&fields=policy`);
	await api.call('POST', '/permissions', {
		data: {
			policy: access!.policy,
			collection: 'directus_notifications',
			action: 'delete',
			fields: ['*'],
			permissions: { recipient: { _eq: '$CURRENT_USER' } },
			validation: {},
		},
	});
	user = await fixtures.user('payload-notifications', { role });
});

test.afterAll(async () => {
	// The user's notifications go with the user (recipient is cascade deleted, as in Directus).
	await fixtures.cleanup();
	await closeHostDb();
});

/** Replaces the user's notifications by COUNT new ones, created one by one so their timestamps follow `n`. */
async function setup(run: Run): Promise<number[]> {
	const old = await api.call<{ id: number }[]>(
		'GET',
		`/notifications?filter[recipient][_eq]=${user.id}&fields=id&limit=-1`,
	);
	if (old.length > 0) await api.call('DELETE', '/notifications', { data: old.map((row) => row.id) });
	const ids: number[] = [];
	for (let n = 1; n <= COUNT; n++) {
		const row = await api.call<{ id: number }>('POST', '/notifications?fields=id', {
			data: { recipient: user.id, subject: subject(run, n), message: `Message ${n}.` },
		});
		ids.push(row.id);
	}
	return ids;
}

interface Call {
	method: string;
	path: string;
	body: unknown;
}

/** The requests to /notifications while `steps` run: the query by meaning, `keys` of the bodies as `<n>`, sorted. */
async function notificationCalls(page: Page, api: string, ids: number[], steps: () => Promise<void>): Promise<Call[]> {
	const seen: Call[] = [];
	const label = (id: unknown) => (ids.includes(Number(id)) ? `<${ids.indexOf(Number(id)) + 1}>` : id);
	const onRequest = (request: Request) => {
		const path = apiPath(request.url(), api);
		if (!path?.startsWith('/notifications')) return;
		const body = request.postDataJSON() as { keys?: unknown[] } | unknown[] | null;
		seen.push({
			method: request.method(),
			path: canonicalPath(`${path}${new URL(request.url()).search}`),
			body: Array.isArray(body) ? body.map(label) : body && body.keys ? { ...body, keys: body.keys.map(label) } : body,
		});
	};
	page.on('request', onRequest);
	try {
		await steps();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1_000);
	} finally {
		page.off('request', onRequest);
	}
	return seen.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

interface Steps {
	open: () => Promise<void>;
	page2: () => Promise<void>;
	tab: (name: 'Inbox' | 'Archive') => Promise<void>;
	search: (text: string) => Promise<void>;
	/** Selects `subject` and clicks Archive or Unarchive. */
	toggle: (subject: string) => Promise<void>;
	/** Selects `subject`, Delete, confirms. */
	remove: (subject: string) => Promise<void>;
}

/** The same steps on either app; returns the calls of each step and the rows the writes left. */
async function runSteps(page: Page, api: string, run: Run, ids: number[], steps: Steps) {
	const out: Record<string, Call[]> = {};
	const step = async (name: string, action: () => Promise<void>) =>
		(out[name] = await notificationCalls(page, api, ids, action));
	await step('open', steps.open);
	// The writes on the newest rows (page 1), before paging and searching. The Archive tab is opened only once it has a
	// row: the Directus drawer keeps the count of a tab (useItems), so an empty tab seen first stays "No Notifications".
	const before = await snapshot(NOTIFICATIONS_TABLES);
	await step('archive', () => steps.toggle(subject(run, COUNT)));
	await step('archive tab', () => steps.tab('Archive'));
	await step('unarchive', () => steps.toggle(subject(run, COUNT)));
	await step('inbox tab', () => steps.tab('Inbox'));
	await step('delete', () => steps.remove(subject(run, COUNT - 1)));
	await step('page 2', steps.page2);
	await step('search', () => steps.search('pn-03'));
	const db = scopeChanges(
		(await changesSince(before, NOTIFICATIONS_TABLES)) as Record<string, unknown>,
		NOTIFICATIONS_TABLES,
		Object.values(RUN_TAG),
	);
	return { calls: out, db };
}

function directusSteps(p: Page): Steps {
	let drawer: Locator;
	return {
		async open() {
			drawer = await openDirectusNotifications(p);
			await expect(drawer.locator('.v-list-item').first()).toBeVisible();
		},
		async page2() {
			await drawer.locator('.v-pagination').getByRole('button', { name: '2', exact: true }).click();
		},
		async tab(name) {
			await drawer.locator('.v-tab', { hasText: name }).click();
		},
		async search(text) {
			await drawer.locator('.search-input').click();
			await drawer.locator('.search-input input').fill(text);
		},
		async toggle(name) {
			const row = drawer.locator('.v-list-item', { hasText: name });
			await row.locator('.v-checkbox').click();
			await drawer.getByRole('button', { name: /^(archive|move_to_inbox)$/ }).click();
			await expect(row).toHaveCount(0);
		},
		async remove(name) {
			const row = drawer.locator('.v-list-item', { hasText: name });
			await row.locator('.v-checkbox').click();
			await drawer.getByRole('button', { name: 'delete', exact: true }).click();
			await card(p).getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(row).toHaveCount(0);
		},
	};
}

function backofficeSteps(p: Page): Steps {
	const drawer = () => p.getByRole('dialog', { name: 'Notifications' });
	return {
		async open() {
			await p.locator('button[aria-label^="Notifications, "]').click();
			await expect(drawer()).toBeVisible();
			await expect(drawer().getByRole('checkbox').nth(1)).toBeVisible();
		},
		async page2() {
			await drawer().getByRole('navigation', { name: 'Notifications' }).getByRole('button', { name: '2' }).click();
		},
		async tab(name) {
			await drawer().getByRole('tab', { name }).click();
		},
		async search(text) {
			await drawer().getByRole('searchbox').fill(text);
		},
		async toggle(name) {
			await drawer()
				.getByRole('checkbox', { name: `Select ${name}` })
				.click();
			await drawer()
				.getByRole('button', { name: /^(Archive|Unarchive)$/ })
				.click();
			await expect(drawer()).not.toContainText(name);
		},
		async remove(name) {
			await drawer()
				.getByRole('checkbox', { name: `Select ${name}` })
				.click();
			await drawer().getByRole('button', { name: 'Delete', exact: true }).click();
			const confirm = p.getByRole('dialog').filter({ hasText: /This action is permanent/ });
			await confirm.getByRole('button', { name: 'Delete' }).click();
			await expect(confirm).toBeHidden();
			await expect(p.locator('[data-notifications-drawer]')).not.toContainText(name);
		},
	};
}

test('the drawer: list, page 2, tabs, search, Archive, Unarchive, Delete (#196–#203)', async ({ browser, page }) => {
	let ids = await setup('dir');
	const dir = await onDirectusApp(browser, (p) => runSteps(p, directusUrl, 'dir', ids, directusSteps(p)), user);

	ids = await setup('bo');
	await signInBackoffice(page, api, user);
	const bo = await runSteps(page, apiUrl, 'bo', ids, backofficeSteps(page));

	expect(dir.calls['archive']!.map((c) => c.method)).toContain('PATCH');
	expect(dir.calls['delete']!.map((c) => c.method)).toContain('DELETE');
	for (const step of Object.keys(dir.calls)) expect.soft(bo.calls[step], step).toEqual(dir.calls[step]);
	expect(bo.db).toEqual(dir.db);
});
