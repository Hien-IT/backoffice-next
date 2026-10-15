// Feature 015 US3/US4 (T083, SC-004, SC-005, contracts/tests.md §4): the Users module sends the writes of the Directus
// app 11.17.4: a new user, an edit of language and appearance then archive, an invite of two emails, a token generated
// then removed, a batch delete. Each app works on its own users (run tags in the emails), deleted in afterAll. The token
// value is random: compared as `<token>`. TFA enable needs a secret generated per run and an OTP from it; it is covered by
// users-tfa-token.spec.ts, not here. proxy-api only.
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { card, goto, headerButton, onDirectusApp } from '../helpers/directus-app.js';
import { calls, normalize, recordWrites, RUN_TAG, signInBackoffice, type Write } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';
import { openUsers } from '../helpers/users.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });

let api: AdminApi;

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	for (const tag of Object.values(RUN_TAG)) {
		const users = await api.call<{ id: string }[]>(
			'GET',
			`/users?fields=id&limit=-1&filter[email][_starts_with]=${encodeURIComponent(tag)}`,
		);
		if (users.length) await api.call('DELETE', '/users', { data: users.map((u) => u.id) });
	}
});

const email = (tag: string, name: string) => `${tag}-${name}@example.com`;

async function user(tag: string, name: string): Promise<string> {
	const { id } = await api.call<{ id: string }>('POST', '/users', { data: { email: email(tag, name), status: 'active' } });
	return id;
}

/** Random token values and generated row keys out of the way: `<token>`. */
function masked(writes: Write[]): Write[] {
	return writes
		.filter((w) => !w.path.startsWith('/presets'))
		.map((w) => {
			const body = w.body as { token?: unknown } | null;
			return body && typeof body.token === 'string' ? { ...w, body: { ...body, token: '<token>' } } : w;
		});
}

async function compare(
	browser: Browser,
	page: Page,
	setup: (tag: string) => Promise<{ ids: string[]; path: string }>,
	directus: (page: Page, tag: string, ids: string[]) => Promise<void>,
	backoffice: (page: Page, tag: string, ids: string[]) => Promise<void>,
) {
	const dir = await setup(RUN_TAG.dir);
	const dirWrites = await onDirectusApp(browser, async (p) => {
		await goto(p, dir.path);
		return recordWrites(p, directusUrl, () => directus(p, RUN_TAG.dir, dir.ids));
	});

	const bo = await setup(RUN_TAG.bo);
	await signInBackoffice(page, api);
	await openUsers(page, bo.path);
	const boWrites = await recordWrites(page, apiUrl, () => backoffice(page, RUN_TAG.bo, bo.ids));
	return [masked(normalize(boWrites, bo.ids)), masked(normalize(dirWrites, dir.ids))] as const;
}

/** A field of the Directus app form by its label. */
const dirField = (page: Page, label: string) =>
	page.locator('.field').filter({ has: page.locator('.field-label', { hasText: new RegExp(`^${label}`) }) });

test('a new user from /users/+ (email and first name)', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		async () => ({ ids: [], path: '/users/+' }),
		async (p, tag) => {
			await dirField(p, 'First Name').locator('input').fill('New');
			await dirField(p, 'Email').locator('input').fill(email(tag, 'new'));
			await headerButton(p, 'check').click();
			await p.waitForURL(/\/admin\/users$/);
		},
		async (p, tag) => {
			await p.getByRole('textbox', { name: 'First Name' }).fill('New');
			await p.getByRole('textbox', { name: 'Email' }).fill(email(tag, 'new'));
			await p.getByRole('button', { name: 'Save', exact: true }).click();
			await p.waitForURL(/\/admin\/users$/);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('edit the appearance, then archive', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		async (tag) => {
			const id = await user(tag, 'edit');
			return { ids: [id], path: `/users/${id}` };
		},
		async (p) => {
			await dirField(p, 'Appearance').locator('.v-input .input').first().click();
			await p.locator('.v-menu-content, .v-list').getByText('Dark', { exact: true }).click();
			await headerButton(p, 'more_vert').click();
			await p.getByText('Save and Stay', { exact: true }).click();
			await p.waitForTimeout(500);
			await headerButton(p, 'archive').click();
			await card(p).getByRole('button', { name: 'Archive', exact: true }).click();
			await p.waitForURL(/\/admin\/users$/);
		},
		async (p) => {
			await p.getByRole('combobox', { name: /^Appearance\b/ }).click();
			await p.getByRole('option', { name: 'Dark', exact: true }).click();
			await p.getByRole('button', { name: 'More save options' }).click();
			await p.getByRole('menuitem', { name: /Save and Stay/ }).click();
			await p.waitForTimeout(500);
			await p.getByRole('button', { name: 'Archive' }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
			await p.waitForURL(/\/admin\/users$/);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('invite two emails from the invited list', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		async () => ({ ids: [], path: '/users/invited' }),
		async (p, tag) => {
			await headerButton(p, 'person_add').click();
			await card(p).locator('textarea').fill(`${email(tag, 'invite-1')},\n${email(tag, 'invite-2')}`);
			await card(p).getByRole('button', { name: 'Invite' }).click();
			await expect(card(p).locator('textarea')).toBeHidden();
		},
		async (p, tag) => {
			await p.getByRole('button', { name: 'Invite Users' }).click();
			await p.getByRole('dialog').getByLabel('Emails').fill(`${email(tag, 'invite-1')},\n${email(tag, 'invite-2')}`);
			await p.getByRole('dialog').getByRole('button', { name: 'Invite' }).click();
			await expect(p.getByRole('dialog')).toBeHidden();
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('generate a token, then remove it', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		async (tag) => {
			const id = await user(tag, 'token');
			return { ids: [id], path: `/users/${id}` };
		},
		async (p) => {
			await p.locator('.system-token .regenerate-icon').click();
			await expect(p.locator('.system-token .clear-icon')).toBeVisible();
			await p.locator('.system-token .clear-icon').click();
			await card(p).getByRole('button', { name: /Remove Token/ }).click();
			await expect(p.locator('.system-token .clear-icon')).toHaveCount(0);
		},
		async (p) => {
			await p.getByRole('button', { name: 'Generate Token' }).click();
			await expect(p.getByRole('button', { name: 'Remove Token' })).toBeVisible();
			await p.getByRole('button', { name: 'Remove Token' }).click();
			await p.getByRole('dialog', { name: 'Remove Token' }).getByRole('button', { name: 'Remove Token' }).click();
			await expect(p.getByRole('button', { name: 'Remove Token' })).toHaveCount(0);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('batch delete of two users found by search', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		async (tag) => {
			const a = await user(tag, 'batch-a');
			const b = await user(tag, 'batch-b');
			return { ids: [a, b], path: '/users' };
		},
		async (p, tag) => {
			await p.locator('.search-input').click();
			await p.locator('.search-input input').fill(`${tag}-batch`);
			const rows = p.locator('tbody tr, .table-row').filter({ hasText: `${tag}-batch` });
			await expect(rows).toHaveCount(2);
			for (const row of await rows.all()) await row.locator('.v-checkbox, [role="checkbox"]').first().click();
			await headerButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(rows).toHaveCount(0);
		},
		async (p, tag) => {
			await p.getByRole('button', { name: 'Search', exact: true }).click();
			await p.getByRole('searchbox', { name: 'Search Items...' }).fill(`${tag}-batch`);
			const table = p.getByRole('main').getByRole('table');
			await expect(table.locator('tbody tr')).toHaveCount(2);
			const boxes = table.getByRole('checkbox', { name: 'Select Item' });
			await boxes.nth(0).check();
			await boxes.nth(1).check();
			await p.getByRole('button', { name: 'Delete' }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(p.getByRole('main').getByText(`${tag}-batch-a`)).toHaveCount(0);
		},
	);

	// The selection order follows the table order of each app (email sort): compare the deleted keys as a set.
	const sorted = (writes: typeof bo) =>
		writes.map((w) => (Array.isArray(w.body) ? { ...w, body: [...(w.body as string[])].sort() } : w));
	expect(calls(bo)).toEqual(calls(dir));
	expect(sorted(bo)).toEqual(sorted(dir));
});
