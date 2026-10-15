// Feature 015 T100 (SC-008, FR-111): axe on the Files and Users screens over the fixture API, light and `html.dark`:
// the library (root, a folder, a special view), the file page of an image, the directory (status, role), the user page
// and a new user, and open dialogs (add file, invite; the image editor in its own test). 0 serious or critical violations outside
// EXCEPTIONS. The crop box of the image editor is mouse only (FR-046, accepted in qa/handoff-checklist.md); the editor
// itself is scanned by components/files/ImageEditor.browser.test.ts.
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import axe from 'axe-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../api/sdk.ts';
import { resetFoldersForTests } from '../composables/use-folders.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { usePermissionsStore } from '../stores/permissions.ts';
import { usePresetsStore } from '../stores/presets.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { useServerStore } from '../stores/server.ts';
import { useSettingsStore } from '../stores/settings.ts';
import { useUserStore } from '../stores/user.ts';
import '../styles/index.css';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { mountLayout } from '../test-utils/layout.ts';
import files from './files.ts';
import { getInternalModules, registeredModules } from './index.ts';
import { resetNavigationForTests } from './users/composables/use-navigation.ts';
import users from './users.ts';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Accepted exceptions (FR-111): `color-contrast` of data colors set with an inline style (the theme preview cards of
 * system-theme draw the Directus theme colors on purpose, D-88; card colors from data), as the Content module test.
 */
const EXCEPTIONS: { rule: string; applies: (el: Element) => boolean }[] = [
	{
		rule: 'color-contrast',
		applies: (el) => {
			for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
				if (/(^|;)\s*(color|background(-color)?|border-color|--theme--)/.test(node.getAttribute('style') ?? '')) return true;
			}
			return false;
		},
	},
];

const snapshot = loadSnapshot();
let fetch: ReturnType<typeof mockFixtureApi>;
let noTransitions: HTMLStyleElement;

beforeAll(async () => {
	await page.viewport(1280, 900);
	noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
});

afterAll(() => noTransitions.remove());

beforeEach(async () => {
	vi.unstubAllGlobals();
	resetFoldersForTests();
	resetNavigationForTests();
	localStorage.clear();
	await replaceQueue();
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
	assertOnlyKnownRequests(calls(fetch));
});

async function hydrate() {
	const [user, permissions, fields, relations, collections, presets, settings, server] = [
		useUserStore(),
		usePermissionsStore(),
		useFieldsStore(),
		useRelationsStore(),
		useCollectionsStore(),
		usePresetsStore(),
		useSettingsStore(),
		useServerStore(),
	];
	fetch = mockFixtureApi(structuredClone(snapshot));
	await user.hydrate();
	registeredModules.value = getInternalModules();
	await Promise.all([permissions.hydrate(), fields.hydrate()]);
	await Promise.all([relations.hydrate(), collections.hydrate(), presets.hydrate(), settings.hydrate()]);
	server.info.queryLimit = { default: 100, max: -1 };
	server.info.files = { mimeTypeAllowList: ['*/*'] };
}

const shell = { render: () => h(RouterView) };
const routes: RouteRecordRaw[] = [
	{ path: '/files', component: shell, children: files.routes as RouteRecordRaw[] },
	{ path: '/users', component: shell, children: users.routes as RouteRecordRaw[] },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function mountPage(path: string) {
	const mounted = await mountLayout(shell, { path, routes, beforeMount: hydrate });
	await settle();
	return mounted;
}

async function settle() {
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 400));
	await flushPromises();
}

async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) =>
			v.nodes
				.filter((n) => {
					const el = document.querySelector(String(n.target[0]));
					return !EXCEPTIONS.some((e) => e.rule === v.id && el && e.applies(el));
				})
				.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`),
		);
}

async function bothSchemes() {
	expect(await violations(), 'light').toEqual([]);
	document.documentElement.classList.add('dark');
	expect(await violations(), 'dark').toEqual([]);
	document.documentElement.classList.remove('dark');
}

const folderId = (name: string) => snapshot.directoryFolders.find((f) => f['name'] === name)!['id'] as string;
const fileId = (title: string) => snapshot.directoryFiles.find((f) => f['title'] === title)!['id'] as string;
const roleId = (name: string) => snapshot.roles.find((r) => r['name'] === name)!['id'] as string;
const userId = (email: string) => snapshot.directoryUsers.find((u) => u['email'] === email)!['id'] as string;
const named = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === name);

describe('Files screens', () => {
	test('the library root', async () => {
		await mountPage('/files');
		await bothSchemes();
	});

	test('a folder with sub folders', async () => {
		await mountPage(`/files/folders/${folderId('bo-files')}`);
		await bothSchemes();
	});

	test('the "all files" view', async () => {
		await mountPage('/files/all');
		await bothSchemes();
	});

	test('the file page of an image', async () => {
		await mountPage(`/files/${fileId('bo-edit')}`);
		await bothSchemes();
	});

	test('dialog: add file (+ route)', async () => {
		await mountPage(`/files/folders/${folderId('bo-files')}/+`);
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await bothSchemes();
	});
});

describe('Users screens', () => {
	test('the active users list', async () => {
		await mountPage('/users');
		await bothSchemes();
	});

	test('the users of a role', async () => {
		await mountPage(`/users/roles/${roleId('bo-editor')}`);
		await bothSchemes();
	});

	test('the user page with the six system interfaces', async () => {
		await mountPage(`/users/${userId('bo-active@example.com')}`);
		await settle();
		await bothSchemes();
	});

	test('a new user', async () => {
		await mountPage('/users/+');
		await bothSchemes();
	});

	test('dialog: invite users', async () => {
		await mountPage('/users/invited');
		named('Invite Users')!.click();
		await settle();
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await bothSchemes();
	});
});
