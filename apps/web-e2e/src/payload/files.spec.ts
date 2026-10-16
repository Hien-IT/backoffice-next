// Feature 015 US2 (T048, SC-004, contracts/tests.md §4): the Files module sends the writes of the Directus app 11.17.4:
// folders (create, rename, delete moving the content up), the file page (metadata save, move to a folder, save as copy,
// delete), an upload through the `+` dialog and a replace, a batch move. Each app works in its own folder of this
// configuration (run tags), deleted in afterAll. Multipart bodies compare part names and file names only (the bytes are
// compared by the image editor spec). proxy-api only.
import type { Browser, Page } from '@playwright/test';
import { AdminApi } from '../helpers/api.js';
import { apiUrl, directusUrl, e2eConfig } from '../helpers/config.js';
import { card, goto, headerButton, onDirectusApp } from '../helpers/directus-app.js';
import { folderTree, openFiles } from '../helpers/files.js';
import { calls, captureFormData, normalize, recordWrites, RUN_TAG, signInBackoffice } from '../helpers/payload.js';
import { expect, test } from '../helpers/requests.js';

test.skip(e2eConfig !== 'proxy-api', 'payload comparison runs in proxy-api only');
test.use({ actionTimeout: 15_000 });

let api: AdminApi;
let png: Buffer;
const folders: string[] = [];

test.beforeAll(async ({ playwright }) => {
	api = new AdminApi(await playwright.request.newContext());
	const [edit] = await api.call<{ id: string }[]>('GET', '/files?fields=id&filter[title][_eq]=bo-edit');
	png = await api.bytes(`/assets/${edit!.id}`);
});

test.afterAll(async () => {
	for (const tag of Object.values(RUN_TAG)) {
		const files = await api.call<{ id: string }[]>(
			'GET',
			`/files?fields=id&limit=-1&filter[filename_download][_starts_with]=${tag}`,
		);
		if (files.length) await api.call('DELETE', '/files', { data: files.map((f) => f.id) });
	}
	const left = await api.call<{ id: string }[]>(
		'GET',
		`/folders?fields=id&limit=-1&filter[name][_starts_with]=${RUN_TAG.dir.replace(/-dir$/, '')}`,
	);
	if (left.length) await api.call('DELETE', '/folders', { data: left.map((f) => f.id) });
});

async function folder(name: string, parent: string | null = null): Promise<string> {
	const { id } = await api.call<{ id: string }>('POST', '/folders', { data: { name, parent } });
	folders.push(id);
	return id;
}

async function file(tag: string, name: string, folderId: string): Promise<string> {
	const { id } = await api.call<{ id: string }>('POST', '/files', {
		multipart: {
			folder: folderId,
			title: `${tag} ${name}`,
			file: { name: `${tag}-${name}.png`, mimeType: 'image/png', buffer: png },
		},
	});
	return id;
}

/** The same scenario on both apps, each in its own folder; returns [Backoffice, Directus] writes, normalized. */
async function compare(
	browser: Browser,
	page: Page,
	name: string,
	setup: (tag: string) => Promise<{ ids: string[]; path: string }>,
	directus: (page: Page, tag: string, ids: string[]) => Promise<void>,
	backoffice: (page: Page, tag: string, ids: string[]) => Promise<void>,
) {
	const dir = await setup(RUN_TAG.dir);
	const dirWrites = await onDirectusApp(browser, async (p) => {
		await captureFormData(p);
		await goto(p, dir.path);
		return recordWrites(p, directusUrl, () => directus(p, RUN_TAG.dir, dir.ids));
	});

	const bo = await setup(RUN_TAG.bo);
	await captureFormData(page);
	await signInBackoffice(page, api);
	if (bo.path.endsWith('/+')) {
		// The add-file dialog is modal: the page heading is hidden from the accessibility tree.
		await page.goto(`/admin${bo.path}`);
		await expect(page.getByRole('dialog')).toBeVisible();
	} else {
		await openFiles(page, bo.path);
	}
	const boWrites = await recordWrites(page, apiUrl, () => backoffice(page, RUN_TAG.bo, bo.ids));
	void name;
	// The library preset saves itself on a timer after navigations (compared by payload/presets.spec.ts): left out.
	const own = (writes: ReturnType<typeof normalize>) => writes.filter((w) => !w.path.startsWith('/presets'));
	return [own(normalize(boWrites, bo.ids)), own(normalize(dirWrites, dir.ids))] as const;
}

/* ------------------------------------------------------------------------------------------- Directus app steps */

/** The navigation folder row of the Directus app (v-list-item with the folder name). */
const dirFolderRow = (page: Page, name: string) =>
	page.locator('#navigation .v-list-item, [role="navigation"] .v-list-item').filter({ hasText: name }).first();

async function dirDialogInput(page: Page, value: string) {
	await page.locator('.v-dialog input, .v-card input').last().fill(value);
}

test('folders: create, rename, delete moving the content up', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		'folders',
		async (tag) => {
			const parent = await folder(`${tag} folders`);
			return { ids: [parent], path: `/files/folders/${parent}` };
		},
		async (p, tag) => {
			await headerButton(p, 'create_new_folder').click();
			await dirDialogInput(p, `${tag} child`);
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(dirFolderRow(p, `${tag} child`)).toBeVisible();

			await dirFolderRow(p, `${tag} child`).click({ button: 'right' });
			await p.getByText('Rename Folder', { exact: true }).click();
			await dirDialogInput(p, `${tag} renamed`);
			await card(p).getByRole('button', { name: 'Save' }).click();
			await expect(dirFolderRow(p, `${tag} renamed`)).toBeVisible();

			await dirFolderRow(p, `${tag} renamed`).click({ button: 'right' });
			await p.getByText('Delete Folder', { exact: true }).click();
			await card(p).getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(dirFolderRow(p, `${tag} renamed`)).toHaveCount(0);
		},
		async (p, tag) => {
			await p.getByRole('button', { name: 'Create Folder' }).click();
			await p.getByRole('dialog').getByLabel('Folder Name').fill(`${tag} child`);
			await p.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
			const tree = await folderTree(p);
			await tree.getByRole('button', { name: `Options for ${tag} child` }).click();
			await p.getByRole('menuitem', { name: 'Rename Folder' }).click();
			await p.getByRole('dialog').getByLabel('Folder Name').fill(`${tag} renamed`);
			await p.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
			await expect(tree.getByRole('link', { name: new RegExp(`${tag} renamed$`) })).toBeVisible();
			await tree.getByRole('button', { name: `Options for ${tag} renamed` }).click();
			await p.getByRole('menuitem', { name: 'Delete Folder' }).click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(tree.getByRole('link', { name: new RegExp(`${tag} renamed$`) })).toHaveCount(0);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('file page: save metadata, move to a folder, save as copy, delete', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		'file page',
		async (tag) => {
			const parent = await folder(`${tag} page`);
			// At the root: both folder pickers show the root folders without opening a branch.
			const target = await folder(`${tag} target`);
			const id = await file(tag, 'page', parent);
			return { ids: [parent, target, id], path: `/files/${id}` };
		},
		async (p, tag, ids) => {
			const title = p.locator('.field').filter({ hasText: /^Title/ }).locator('input');
			await title.fill(`${tag} saved`);
			await headerButton(p, 'more_vert').click();
			await p.getByText('Save and Stay', { exact: true }).click();
			await expect(title).toHaveValue(`${tag} saved`);

			// The move button's icon is a custom SVG (no ligature name).
			await p.locator('header button:has(svg.custom-icon-svg)').first().click();
			await card(p).getByText(`${tag} target`).click();
			await card(p).getByRole('button', { name: 'Move' }).click();
			await expect(p.getByText(/File Moved/)).toBeVisible();
			// The copy takes the folder of the reloaded item: wait for the reload (breadcrumb to the new folder).
			await expect(p.locator(`a[href="/admin/files/folders/${ids[1]}"]`).first()).toBeAttached();

			await title.fill(`${tag} copy`);
			await headerButton(p, 'more_vert').click();
			await p.getByText('Save as Copy', { exact: true }).click();
			await expect(p).not.toHaveURL(/files\/[^/]+$/, { timeout: 2_000 }).catch(() => undefined);
			await p.waitForURL((url) => !url.pathname.endsWith('/+'));

			await headerButton(p, 'delete').click();
			await card(p).getByRole('button', { name: 'Delete', exact: true }).click();
			await p.waitForURL(/\/admin\/files(\/folders\/[^/]+)?$/);
		},
		async (p, tag, ids) => {
			const title = p.getByRole('textbox', { name: 'Title' });
			await title.fill(`${tag} saved`);
			await p.getByRole('button', { name: 'More save options' }).click();
			await p.getByRole('menuitem', { name: /Save and Stay/ }).click();
			await expect(title).toHaveValue(`${tag} saved`);

			await p.getByRole('button', { name: 'Move to Folder' }).click();
			const dialog = p.getByRole('dialog', { name: 'Move to Folder' });
			await dialog.locator('[data-tree-row]', { hasText: `${tag} target` }).click();
			await dialog.getByRole('button', { name: 'Move', exact: true }).click();
			await expect(p.getByText('File Moved', { exact: true })).toBeVisible();
			await expect(
				p.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'File Library' }),
			).toHaveAttribute('href', `/admin/files/folders/${ids[1]}`);

			await title.fill(`${tag} copy`);
			await p.getByRole('button', { name: 'More save options' }).click();
			await p.getByRole('menuitem', { name: /Save as Copy/ }).click();
			await p.waitForURL((url) => !url.pathname.endsWith('/+'));

			await p.getByRole('button', { name: 'Delete', exact: true }).first().click();
			await p.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await p.waitForURL(/\/admin\/files(\/folders\/[^/]+)?$/);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('upload one file through the + dialog, then replace it from its page', async ({ browser, page }) => {
	const upload = (tag: string) => ({ name: `${tag}-upload.png`, mimeType: 'image/png', buffer: png });

	const [bo, dir] = await compare(
		browser,
		page,
		'upload',
		async (tag) => {
			const parent = await folder(`${tag} upload`);
			return { ids: [parent], path: `/files/folders/${parent}/+` };
		},
		async (p, tag) => {
			await p.locator('.v-dialog input[type="file"], .v-card input[type="file"]').first().setInputFiles(upload(tag));
			await p.waitForURL((url) => !url.pathname.endsWith('/+'));
			// Client-side navigation: a page load would drop the FormData parts recorded so far (captureFormData).
			await p.locator('.card').filter({ hasText: /upload/i }).first().click();
			await p.waitForURL(/\/admin\/files\/[0-9a-f-]{36}$/);
			await p.getByRole('button', { name: /Replace File/ }).click();
			await p.locator('.v-dialog input[type="file"], .v-card input[type="file"]').first().setInputFiles(upload(tag));
			await p.waitForTimeout(1_000);
		},
		async (p, tag) => {
			await p.getByRole('dialog', { name: 'Add File' }).locator('input[type="file"]').setInputFiles(upload(tag));
			await p.waitForURL((url) => !url.pathname.endsWith('/+'));
			const [created] = await api.call<{ id: string }[]>(
				'GET',
				`/files?fields=id&filter[filename_download][_eq]=${tag}-upload.png`,
			);
			await openFiles(p, `/files/${created!.id}`);
			await p.getByRole('button', { name: 'Replace File' }).click();
			await p.getByRole('dialog', { name: 'Replace File' }).locator('input[type="file"]').setInputFiles(upload(tag));
			await p.waitForTimeout(1_000);
		},
	);

	expect(calls(bo)).toEqual(calls(dir));
	expect(bo).toEqual(dir);
});

test('batch move of two files from the library', async ({ browser, page }) => {
	const [bo, dir] = await compare(
		browser,
		page,
		'batch move',
		async (tag) => {
			const parent = await folder(`${tag} batch`);
			const target = await folder(`${tag} batch target`);
			const a = await file(tag, 'batch-a', parent);
			const b = await file(tag, 'batch-b', parent);
			return { ids: [parent, target, a, b], path: `/files/folders/${parent}` };
		},
		async (p, tag) => {
			for (const card of await p.locator('.card').filter({ hasText: /batch/i }).all()) {
				await card.hover();
				await card.locator('.selector').click();
			}
			await p.locator('header button:has(svg.custom-icon-svg)').first().click();
			await card(p).getByText(`${tag} batch target`).click();
			await card(p).getByRole('button', { name: 'Move' }).click();
			await expect(p.locator('.card').filter({ hasText: /batch-a|batch a/i })).toHaveCount(0);
		},
		async (p, tag) => {
			for (const name of ['batch-a', 'batch-b']) {
				await p.getByRole('main').getByRole('checkbox', { name: `Select ${tag} ${name}`, exact: true }).click({ force: true });
			}
			await p.getByRole('button', { name: 'Move to Folder' }).click();
			const dialog = p.getByRole('dialog', { name: 'Move to Folder' });
			await dialog.locator('[data-tree-row]', { hasText: `${tag} batch target` }).click();
			await dialog.getByRole('button', { name: 'Move', exact: true }).click();
			await expect(dialog).toBeHidden();
		},
	);

	// Both files may share their upload second, so the card order (and the order of `keys`) is not fixed.
	const sortedKeys = (writes: typeof bo) =>
		writes.map((w) => {
			const body = w.body as { keys?: string[] } | null;
			return body?.keys ? { ...w, body: { ...body, keys: [...body.keys].sort() } } : w;
		});
	expect(calls(bo)).toEqual(calls(dir));
	expect(sortedKeys(bo)).toEqual(sortedKeys(dir));
});
