// Feature 016 (T091, US5-1, US5-2, US5-5, FR-072, FR-076): the Project and Appearance pages as DR project.vue and
// appearance/item.vue: the fields of directus_settings without the theming, AI and MCP groups (Appearance: theming
// only), collaborative editing read-only without websockets, save sends `PATCH /settings` with the edited keys only
// and reloads the server info. The fields come from settings.yaml of DR 11.17.4: every interface it names is
// registered, with its option keys, and the two special fields keep their DR interface and options.
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import registry from '../../../../../fixtures/interfaces/directus-registry.json';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoForm from '../../../../components/form/BoForm.vue';
import { getInterfaces } from '../../../../interfaces/index.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { useSettingsStore } from '../../../../stores/settings.ts';
import { calls, json, mockApi } from '../../../../test-utils/fetch.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import AppearanceRoute from '../appearance/AppearanceRoute.vue';
import ProjectRoute from './ProjectRoute.vue';

enableAutoUnmount(afterEach);

type YamlField = { field: string; interface?: string; options?: Record<string, unknown>; group?: string } & Record<
	string,
	unknown
>;

const here = dirname(fileURLToPath(import.meta.url));
const SETTINGS_YAML = (
	load(
		readFileSync(join(here, '../../../../../../../directus/packages/system-data/src/fields/settings.yaml'), 'utf8'),
	) as { fields: YamlField[] }
).fields;

/** The fields of the store as /fields returns system fields: the yaml keys under `meta`. */
const SETTINGS_FIELDS = SETTINGS_YAML.map(({ field, ...meta }, sort) => ({
	collection: 'directus_settings',
	field,
	name: field,
	type: Array.isArray(meta['special']) && (meta['special'] as string[]).includes('alias') ? 'alias' : 'string',
	schema: null,
	meta: { collection: 'directus_settings', field, sort, group: null, ...meta },
})) as unknown as Field[];

const GROUPS = ['theming_group', 'ai_group', 'mcp_group'];

beforeEach(async () => {
	await replaceQueue();
});

let fetch: ReturnType<typeof mockApi>;

async function open(component: typeof ProjectRoute) {
	fetch = mockApi({
		'PATCH /settings': ({ init }: { init: RequestInit }) =>
			json({ data: { project_name: 'Old', ...JSON.parse(String(init.body)) } }),
		'GET /server/info': { project: {}, websocket: false },
		'GET /auth': [],
	});
	const mounted = await mountLayout(component, {
		beforeMount() {
			const collections = useCollectionsStore();
			collections.collections = [
				collections.prepareCollectionForApp({ collection: 'directus_settings', schema: {}, meta: null } as never),
			];
			useFieldsStore().fields = SETTINGS_FIELDS as never;
			useSettingsStore().settings = { id: 1, project_name: 'Old', module_bar: null } as never;
			useServerStore().info.websocket = false;
		},
	});
	await flushPromises();
	return mounted;
}

const formFields = (wrapper: Awaited<ReturnType<typeof open>>['wrapper']) =>
	wrapper.findComponent(BoForm).props('fields') as Field[];

describe('ProjectRoute', () => {
	test('every field but the theming, AI and MCP groups and their children', async () => {
		const { wrapper } = await open(ProjectRoute);
		const names = formFields(wrapper).map((field) => field.field);

		const excluded = SETTINGS_YAML.filter((f) => GROUPS.includes(f.field) || GROUPS.includes(f.group ?? '')).map(
			(f) => f.field,
		);
		expect(excluded.length).toBeGreaterThan(5);
		expect(names.some((name) => excluded.includes(name))).toBe(false);
		expect(names).toEqual(expect.arrayContaining(['project_name', 'project_owner', 'module_bar', 'basemaps']));
	});

	test('collaborative_editing_enabled is read-only without websockets', async () => {
		const { wrapper } = await open(ProjectRoute);

		expect(formFields(wrapper).find((field) => field.field === 'collaborative_editing_enabled')?.meta?.readonly).toBe(
			true,
		);
	});

	test('save: PATCH /settings with the edited keys only, then the server info reloads', async () => {
		const { wrapper } = await open(ProjectRoute);

		const save = wrapper.get('button[aria-label="Save"]');
		expect(save.attributes('disabled')).toBeDefined();

		wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { project_name: 'New name' });
		await flushPromises();
		await save.trigger('click');
		await flushPromises();

		const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
		expect(JSON.parse(String(patch[1]!.body))).toEqual({ project_name: 'New name' });
		expect(calls(fetch)).toContain('GET /server/info');
		expect(useSettingsStore().settings?.project_name).toBe('New name');
		expect(wrapper.get('button[aria-label="Save"]').attributes('disabled')).toBeDefined();
	});
});

test('AppearanceRoute: the theming group and its children, without the Directus theme fields (D-168)', async () => {
	const { wrapper } = await open(AppearanceRoute);
	const names = formFields(wrapper).map((field) => field.field);
	const themeFields = ['default_theme_light', 'theme_light_overrides', 'default_theme_dark', 'theme_dark_overrides'];

	expect(names).toEqual(
		SETTINGS_YAML.filter((f) => f.field === 'theming_group' || f.group === 'theming_group')
			.map((f) => f.field)
			.filter((field) => !themeFields.includes(field)),
	);
	expect(names).toEqual(expect.arrayContaining(['project_color', 'default_appearance', 'custom_css']));
	expect(names).not.toEqual(expect.arrayContaining(['default_theme_light']));
});

describe('settings.yaml against the registry (FR-072, FR-076)', () => {
	const fixture = registry as unknown as { interfaces: Record<string, { optionKeys: string[] }> };
	const registered = new Set(getInterfaces().map((inter) => inter.id));
	const visible = SETTINGS_YAML.filter(
		(f) => f.interface && !GROUPS.includes(f.field) && !GROUPS.includes(f.group ?? ''),
	);

	test.each(visible.map((f) => [f.field, f.interface!] as const))('%s: interface %s is registered', (_field, id) => {
		expect(registered.has(id)).toBe(true);
	});

	test('option keys of the non-system interfaces exist in the registry', () => {
		const unknown = visible
			.filter((f) => f.options && !f.interface!.startsWith('system-') && fixture.interfaces[f.interface!])
			.flatMap((f) =>
				Object.keys(f.options!)
					.filter((key) => !fixture.interfaces[f.interface!]!.optionKeys.includes(key))
					.map((key) => `${f.field}.${key}`),
			);

		// `icon` and `title` of mapbox_key are not options of the DR input interface either (the registry fixture
		// is extracted from DR): both apps ignore them.
		expect(unknown).toEqual(['mapbox_key.icon', 'mapbox_key.title']);
	});

	test('public_registration_email_filter is a system-filter on directus_users; report_error_url a display template', () => {
		const filter = SETTINGS_YAML.find((f) => f.field === 'public_registration_email_filter')!;
		expect(filter.interface).toBe('system-filter');
		expect(filter.options).toMatchObject({ collectionName: 'directus_users' });

		const report = SETTINGS_YAML.find((f) => f.field === 'report_error_url')!;
		expect(report.interface).toBe('system-display-template');
	});
});
