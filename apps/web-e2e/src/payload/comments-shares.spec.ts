// Feature 014 US7 (T091, SC-004, contracts/tests.md §4): the item sidebar sends the comment writes of the Directus app
// 11.17.4: a comment with a mention (POST /comments, `@<user id>` in the text), its edit (PATCH) and delete. Each run
// gets its own item (DATA_PREFIX), deleted in afterAll with its comments. proxy-api only. The share case left with the
// Shares section (spec 025, FR-029, D-189.4).
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { openItem, openSidebar } from '../helpers/content.js';
import { card, goto, onDirectusApp, postComment, sidebar, sidebarItemMenu } from '../helpers/directus-app.js';
import { calls, normalize, recordWrites, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });

const MENTION = 'Admin User';

let api: AdminApi;
const items: number[] = [];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
});

test.afterAll(async () => {
	await api.call('POST', '/utils/cache/clear');
	for (const item of items) {
		const rows = await api.call<{ id: string }[]>(
			'GET',
			`/comments?fields=id&filter[collection][_eq]=bo_content&filter[item][_eq]=${item}`,
		);
		if (rows.length) await api.call('DELETE', '/comments', { data: rows.map((r) => r.id) });
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
