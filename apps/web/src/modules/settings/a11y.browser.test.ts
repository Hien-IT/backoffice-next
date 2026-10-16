// Feature 016 T114 (SC-008, FR-106): axe on the 13 Settings screens of SC-004 and the four drawers and dialogs (new
// collection, field drawer in both modes, permission detail, delete collection), light and `html.dark`, over the fixture
// API with the system collections, fields and relations of Directus system-data and the Settings rows of the fixture
// set (settings.*.json). 0 serious or critical violations outside EXCEPTIONS.
import { page } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import axe from 'axe-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import access from '../../../fixtures/interfaces/snapshot/settings.access.json';
import permissions from '../../../fixtures/interfaces/snapshot/settings.permissions.json';
import policies from '../../../fixtures/interfaces/snapshot/settings.policies.json';
import roles from '../../../fixtures/interfaces/snapshot/settings.roles.json';
import translations from '../../../fixtures/interfaces/snapshot/settings.translations.json';
import { replaceQueue } from '../../api/sdk.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { usePresetsStore } from '../../stores/presets.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useSettingsStore } from '../../stores/settings.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { getInternalModules, registeredModules } from '../index.ts';
import settings from '../settings.ts';
import { systemCollections, systemFields, systemRelations } from './test-system-data.ts';

enableAutoUnmount(afterEach);

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Accepted exceptions (FR-106): `color-contrast` of data colors set with an inline style (collection icon colors, the
 * theme preview cards of system-theme, D-88; the interface preview SVGs of the field drawer), as 014 and 015.
 */
const EXCEPTIONS: { rule: string; applies: (el: Element) => boolean }[] = [
	{
		rule: 'color-contrast',
		applies: (el) => {
			for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
				if (/(^|;)\s*(color|background(-color)?|border-color|--theme--)/.test(node.getAttribute('style') ?? ''))
					return true;
			}
			return false;
		},
	},
];

const ROLE = roles[0]!;
const POLICY = policies[0]!;
const PERMISSIONS = permissions.map((row, index) => ({ id: index + 1, ...row }));
const TRANSLATIONS = translations.map((row, index) => ({ id: `t${index + 1}`, ...row }));

const snapshot = loadSnapshot();
const fixture = structuredClone(snapshot);
const known = new Set(fixture.systemFields.map((f) => `${f.collection}.${f.field}`));
fixture.systemFields.push(...(systemFields().filter((f) => !known.has(`${f.collection}.${f.field}`)) as never[]));
const knownCollections = new Set(fixture.systemCollections.map((c) => c['collection']));
fixture.systemCollections.push(...systemCollections().filter((c) => !knownCollections.has(c['collection'])));
fixture.relations.push(...systemRelations());

const PRESET = snapshot.presets.find((p) => p['bookmark'] !== null) ?? snapshot.presets[0]!;

/** The rows, or the `aggregate[count]` answer of `use-relation-multiple` (`[{ count: { id } }]`) for the same path. */
const rowsOrCount =
	(rows: unknown[]) =>
	({ url }: { url: URL }) =>
		json({
			data: [...url.searchParams.keys()].some((k) => k.startsWith('aggregate'))
				? [{ count: { id: rows.length } }]
				: rows,
		});

const ACCESS = access.map((row, index) => ({ id: `a${index + 1}`, ...row }));

const answers = {
	'GET /roles': [{ ...ROLE, users: [{ count: { id: 1 } }], children: [] }],
	[`GET /roles/${ROLE.id}`]: ROLE,
	'GET /policies': [{ ...POLICY, users: [{ count: { user: 0 } }], roles: [{ count: { role: 1 } }] }],
	[`GET /policies/${POLICY.id}`]: POLICY,
	'GET /permissions': rowsOrCount(PERMISSIONS),
	'GET /permissions/1': PERMISSIONS[0],
	'GET /access': rowsOrCount(ACCESS),
	'GET /translations': ({ url }: { url: URL }) =>
		json({ data: [...url.searchParams.keys()].some((k) => k.startsWith('aggregate')) ? [{ count: 2 }] : TRANSLATIONS }),
	'GET /translations/t1': TRANSLATIONS[0],
	'GET /fields/bo_std/input_string': snapshot.fields.find(
		(f) => f.collection === 'bo_std' && f.field === 'input_string',
	),
	[`GET /presets/${PRESET['id']}`]: PRESET,
};

let noTransitions: HTMLStyleElement;

beforeAll(async () => {
	await page.viewport(1280, 900);
	noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
});

afterAll(() => noTransitions.remove());

beforeEach(async () => {
	vi.unstubAllGlobals();
	localStorage.clear();
	await replaceQueue();
});

afterEach(() => {
	document.documentElement.classList.remove('dark');
});

async function hydrate() {
	mockFixtureApi(fixture, { answers: answers as never });
	await useUserStore().hydrate();
	registeredModules.value = getInternalModules();
	await Promise.all([usePermissionsStore().hydrate(), useFieldsStore().hydrate()]);
	await Promise.all([
		useRelationsStore().hydrate(),
		useCollectionsStore().hydrate(),
		usePresetsStore().hydrate(),
		useSettingsStore().hydrate(),
	]);
	const server = useServerStore();
	server.info.queryLimit = { default: 100, max: -1 };
	server.info.websocket = false;
}

const shell = { render: () => h(RouterView) };
const routes: RouteRecordRaw[] = [
	{ path: '/settings', component: shell, children: settings.routes as RouteRecordRaw[] },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function settle() {
	await flushPromises();
	// Lazy interface chunks (matrix, translations form) load later on a loaded runner.
	await new Promise((resolve) => setTimeout(resolve, 1000));
	await flushPromises();
}

async function mountPage(path: string) {
	const mounted = await mountLayout(shell, { path, routes, beforeMount: hydrate });
	await settle();
	return mounted;
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

const named = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a, [role="menuitem"]')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name,
	);

// Each test mounts a page and runs axe twice (light, dark): past the 15 s default on a loaded CI runner.
describe('data model', { timeout: 60_000 }, () => {
	test('the collection list', async () => {
		await mountPage('/settings/data-model');
		await bothSchemes();
	});

	test('drawer: new collection', async () => {
		await mountPage('/settings/data-model/+');
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await bothSchemes();
	});

	test('the collection page (field grid and collection form)', async () => {
		await mountPage('/settings/data-model/bo_std');
		await bothSchemes();
	});

	test('drawer: new field, simple mode (interface cards)', async () => {
		await mountPage('/settings/data-model/bo_std/+');
		expect(document.querySelector('[role="radiogroup"]')).not.toBeNull();
		await bothSchemes();
	});

	test('drawer: an existing field, advanced mode', async () => {
		await mountPage('/settings/data-model/bo_std/input_string');
		expect(document.querySelector('[role="tablist"]')).not.toBeNull();
		await bothSchemes();
	});

	test('dialog: delete a collection', async () => {
		await mountPage('/settings/data-model/bo_std');
		named('Delete Collection')!.click();
		await settle();
		expect(document.querySelector('[role="alertdialog"], [role="dialog"]')).not.toBeNull();
		await bothSchemes();
	});
});

describe('roles and policies', { timeout: 60_000 }, () => {
	test('the role list', async () => {
		await mountPage('/settings/roles');
		await bothSchemes();
	});

	test('the role page', async () => {
		await mountPage(`/settings/roles/${ROLE.id}`);
		await bothSchemes();
	});

	test('the Public page', async () => {
		await mountPage('/settings/roles/public');
		await bothSchemes();
	});

	test('the policy list', async () => {
		await mountPage('/settings/policies');
		await bothSchemes();
	});

	test('the policy page with the permissions matrix', async () => {
		await mountPage(`/settings/policies/${POLICY.id}`);
		expect(document.querySelector('[data-permissions-matrix]')).not.toBeNull();
		await bothSchemes();
	});

	test('drawer: permission detail', async () => {
		await mountPage(`/settings/policies/${POLICY.id}`);
		const chip = document.querySelector<HTMLElement>(
			`[data-permissions-matrix] tr[data-collection="${PERMISSIONS[0]!.collection}"] button[aria-haspopup="menu"]`,
		)!;
		chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
		chip.click();
		await settle();
		const custom = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) =>
			el.textContent?.includes('Use Custom'),
		)!;
		custom.click();
		await settle();
		expect(document.querySelector('[role="dialog"]')).not.toBeNull();
		await bothSchemes();
	});
});

describe('project, presets, translations', { timeout: 60_000 }, () => {
	test('project settings', async () => {
		await mountPage('/settings/project');
		await bothSchemes();
	});

	test('appearance', async () => {
		await mountPage('/settings/appearance');
		await bothSchemes();
	});

	test('the preset list', async () => {
		await mountPage('/settings/presets');
		await bothSchemes();
	});

	test('the preset editor', async () => {
		await mountPage(`/settings/presets/${PRESET['id']}`);
		await bothSchemes();
	});

	test('the translation list', async () => {
		await mountPage('/settings/translations');
		await bothSchemes();
	});

	test('a translation', async () => {
		await mountPage('/settings/translations/t1');
		await bothSchemes();
	});
});
