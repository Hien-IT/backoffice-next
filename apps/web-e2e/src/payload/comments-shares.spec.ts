// Feature 014 US7 (T091, SC-004, contracts/tests.md §4): the item sidebar sends the comment and share writes of the
// Directus app 11.17.4: a comment with a mention (POST /comments, `@<user id>` in the text), its edit (PATCH) and delete;
// a share create (POST /shares), edit (PATCH), invite (POST /shares/invite) and delete. Each run gets its own item
// (DATA_PREFIX), deleted in afterAll with its comments and shares. proxy-api only. Editing a share opens its drawer,
// which reads GET /shares/<id>?fields=* like the Directus app (drawer-item): that call is not yet in
// contracts/api-calls.md (helpers/allowed-paths.ts), so the request check of the share test fails until it is added.
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { openItem, openSidebar } from '../helpers/content.js';
import {
	card,
	goto,
	onDirectusApp,
	openSidebarSection,
	postComment,
	saveShare,
	shareField,
	sidebar,
	sidebarItemMenu,
} from '../helpers/directus-app.js';
import { calls, normalize, recordWrites, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });

const MENTION = 'Admin User';
const INVITE = 'web-e2e-invite@example.com';

let api: AdminApi;
const items: number[] = [];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await api.call('POST', '/utils/cache/clear');
	for (const collection of ['comments', 'shares']) {
		for (const item of items) {
			const rows = await api.call<{ id: string }[]>(
				'GET',
				`/${collection}?fields=id&filter[collection][_eq]=bo_content&filter[item][_eq]=${item}`,
			);
			if (rows.length) await api.call('DELETE', `/${collection}`, { data: rows.map((r) => r.id) });
		}
	}
	if (items.length) await api.call('DELETE', '/items/bo_content', { data: items });
});

async function createItem(tag: string, name: string): Promise<number> {
	const { id } = await api.call<{ id: number }>('POST', '/items/bo_content', {
		data: { title: `${tag} ${name}`, status: 'draft' },
	});
	items.push(id);
	return id;
}

/** Same steps on both apps, each on its own item; returns [Backoffice, Directus] writes, normalized. */
async function compare(
	browser: Browser,
	page: Page,
	name: string,
	directus: (page: Page, tag: string) => Promise<void>,
	backoffice: (page: Page, tag: string) => Promise<void>,
) {
	const dirItem = await createItem(RUN_TAG.dir, name);
	const dir = await onDirectusApp(browser, async (p) => {
		await goto(p, `/content/bo_content/${dirItem}`);
		return recordWrites(p, directusUrl, () => directus(p, RUN_TAG.dir));
	});

	const boItem = await createItem(RUN_TAG.bo, name);
	await signInBackoffice(page, api);
	await openItem(page, 'bo_content', boItem);
	const bo = await recordWrites(page, apiUrl, () => backoffice(page, RUN_TAG.bo));
	return [normalize(bo, [boItem]), normalize(dir, [dirItem])] as const;
}

const boSidebar = (page: Page) => page.getByRole('complementary', { name: 'Sidebar' });
/** A dialog other than the detail popover, which stays open (also `role="dialog"`, owner 2026-10-20). */
const boDialog = (page: Page) => page.getByRole('dialog').filter({ hasNot: page.locator('#sidebar') });

async function boSection(page: Page, name: string) {
	await openSidebar(page);
	const button = boSidebar(page).getByRole('button', { name: new RegExp(`^${name}( \\d+)?$`) });
	if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

test('comment with a mention: create, edit, delete', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		'comments',
		async (page) => {
			await postComment(page, 'Hello', MENTION);
			await expect(sidebar(page).getByRole('button', { name: 'more_horiz' })).toHaveCount(1);

			await sidebarItemMenu(page, 'Edit');
			await sidebar(page).locator('[contenteditable]').nth(1).fill('Edited comment');
			await sidebar(page).getByRole('button', { name: 'Submit' }).last().click();
			await expect(sidebar(page).getByText('Edited comment')).toBeVisible();

			await sidebarItemMenu(page, 'Delete');
			await card(page).getByRole('button', { name: 'Delete' }).click();
			await expect(sidebar(page).getByRole('button', { name: 'more_horiz' })).toHaveCount(0);
		},
		async (page) => {
			await boSection(page, 'Comments');
			const side = boSidebar(page);
			await side.getByRole('textbox', { name: 'Leave a comment...' }).click();
			await page.keyboard.type(`Hello @${MENTION.slice(0, 3)}`);
			await side.getByRole('option', { name: new RegExp(MENTION) }).click();
			await side.getByRole('button', { name: 'Submit' }).click();
			const options = side.getByRole('button', { name: `Options for ${MENTION}` });
			await expect(options).toHaveCount(1);

			await options.click();
			await page.getByRole('menuitem', { name: 'Edit' }).click();
			await side.getByRole('article').getByRole('textbox').fill('Edited comment');
			await side
				.getByRole('article')
				.getByRole('button', { name: /Submit|Save/ })
				.click();
			await expect(side.getByText('Edited comment')).toBeVisible();

			await options.click();
			await page.getByRole('menuitem', { name: 'Delete' }).click();
			await boDialog(page).getByRole('button', { name: 'Delete' }).click();
			await expect(options).toHaveCount(0);
		},
	);

	expect(calls(dir)).toEqual(['POST /comments', 'PATCH /comments/<id2>', 'DELETE /comments/<id2>']);
	expect(bo[0]).toEqual(dir[0]);
	expect(bo[2]).toEqual(dir[2]);
	// Real difference D-91 (spec 014, owner kept the Q-11 textbox 2026-10-16): a Chromium contenteditable quirk, not
	// Directus logic. comment-input.vue loads the edited comment as md() HTML `<p>…</p>\n` into v-template-input;
	// select-all + insert keeps the `\n` text node after `</p>` and puts the new text after it. Firefox and WebKit send
	// "Edited comment" from the same Directus editor; the Backoffice textarea sends it in every browser.
	expect(dir[1]!.body).toEqual({ comment: '\nEdited comment' });
	expect(bo[1]!.body).toEqual({ comment: 'Edited comment' });
});

test('share: create, edit, invite, delete', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		'shares',
		async (page, tag) => {
			await openSidebarSection(page, 'Shares');
			await sidebar(page).getByRole('button', { name: 'New Share' }).click();
			await shareField(page, 'Name').fill(`${tag} share`);
			await shareField(page, 'Max Uses').fill('3');
			await saveShare(page);

			await sidebarItemMenu(page, /Edit/);
			await shareField(page, 'Max Uses').fill('5');
			await saveShare(page);

			await sidebarItemMenu(page, /Send Link/);
			await card(page).getByRole('textbox', { name: 'admin@example.com, user@example.com...' }).fill(INVITE);
			await card(page).getByRole('button', { name: 'Send Link' }).click();
			await expect(card(page).getByRole('button', { name: 'Send Link' })).toHaveCount(0);

			await sidebarItemMenu(page, /Delete/);
			await card(page).getByRole('button', { name: 'Delete' }).click();
			await expect(sidebar(page).getByText('No shares to show')).toBeVisible();
		},
		async (page, tag) => {
			await boSection(page, 'Shares');
			const side = boSidebar(page);
			await side.getByRole('button', { name: 'New Share' }).click();
			const drawer = boDialog(page);
			await drawer.getByRole('textbox', { name: 'Name' }).fill(`${tag} share`);
			await drawer.getByRole('spinbutton', { name: 'Max Uses' }).fill('3');
			await drawer.getByRole('button', { name: 'Save' }).click();
			await expect(drawer).toHaveCount(0);

			const options = side.getByRole('button', { name: `Options for ${tag} share` });
			await options.click();
			await page.getByRole('menuitem', { name: 'Edit' }).click();
			await drawer.getByRole('spinbutton', { name: 'Max Uses' }).fill('5');
			await drawer.getByRole('button', { name: 'Save' }).click();
			await expect(drawer).toHaveCount(0);

			await options.click();
			await page.getByRole('menuitem', { name: 'Send Link' }).click();
			await boDialog(page).getByRole('textbox', { name: 'Emails' }).fill(INVITE);
			await boDialog(page).getByRole('button', { name: 'Send Link' }).click();
			await expect(boDialog(page)).toHaveCount(0);

			await options.click();
			await page.getByRole('menuitem', { name: 'Delete' }).click();
			await boDialog(page).getByRole('button', { name: 'Delete' }).click();
			await expect(side.getByText('No shares to show')).toBeVisible();
		},
	);

	expect(calls(dir)).toEqual(['POST /shares', 'PATCH /shares/<id2>', 'POST /shares/invite', 'DELETE /shares/<id2>']);
	expect(bo).toEqual(dir);
});
