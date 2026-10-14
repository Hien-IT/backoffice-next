// US2 scenarios 1-5 (spec 013) on the fixture snapshot: every bo_* field with a display rendered through RenderDisplay
// with the value read from the fixture API with the display fields (FR-070, FR-073), the handlers of FR-072 and the
// aliases of use-alias-fields.ts. Requests stay in contracts/api-calls.md.
import { readItem } from '@directus/sdk';
import type { FieldRaw } from '@directus/types';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../api/sdk.ts';
import BoTooltip from '../components/BoTooltip.vue';
import RenderDisplay from '../components/render/RenderDisplay.vue';
import { useAliasFields } from '../composables/use-alias-fields.ts';
import { i18n } from '../lang/index.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../utils/adjust-fields-for-displays.ts';
import { getDisplay, getDisplays } from './index.ts';

const snapshot = loadSnapshot();
const displayFields = snapshot.fields.filter((field) => field.meta?.display);

// Text of each display on the first seeded row (whitespace collapsed), at 2026-10-15T00:00:00Z in en-US.
const EXPECTED_TEXT: Record<string, string> = {
	'bo_groups.target': 'Target one',
	'bo_languages.direction': 'Rtl',
	'bo_rel.m2o': 'Target one',
	'bo_rel.m2o_default': '2',
	'bo_rel.owner': 'account_circleEdith Editor',
	'bo_rel.o2m_list': '2 Items',
	'bo_rel.m2m_list': '3 Items',
	'bo_rel.m2a': '2 Items',
	'bo_rel.files': '2 Items',
	'bo_rel.file': 'pdf',
	'bo_rel.file_image': '',
	'bo_rel_target.status': 'Published',
	'bo_std.input_string': 'warningAlpha!',
	'bo_std.input_masked': '**********',
	'bo_std.input_default': 'plain',
	'bo_std.input_integer': 'High',
	'bo_std.input_float': '2.5',
	'bo_std.input_biginteger': '9007199254740993',
	'bo_std.input_decimal': '$12.34',
	'bo_std.input_hash': '**********',
	'bo_std.boolean': 'checkYes',
	'bo_std.boolean_default': 'close',
	'bo_std.date': 'Mar 15, 2024',
	'bo_std.time': '2:30:45 PM',
	'bo_std.date_time': 'Mar 15, 2024 14:30',
	'bo_std.timestamp': '2 years ago',
	'bo_std.timestamp_relative': 'over 2 years',
	'bo_std.slider': 'star'.repeat(20),
	'bo_std.slider_float': 'star 0.4',
	'bo_std.tags': 'Alphacustom-tag',
	'bo_std.tags_csv': 'OneTwo',
	'bo_std.code_json': 'value',
	'bo_std.code_js': 'const a = 1; console.log(a);',
	'bo_std.select_dropdown': 'Alpha',
	'bo_std.select_dropdown_int': '2',
	'bo_std.select_multiple_dropdown': 'BetastarAlpha',
	'bo_std.select_radio': 'beta',
	'bo_std.select_tree': '2 Items',
	'bo_std.select_icon': 'star',
	'bo_std.select_color': '',
	'bo_std.select_color_default': '',
	'bo_std.list': '2 Items',
	'bo_std.map_json': '[object Object]',
	'bo_std.rich_html': 'Hello world',
	'bo_std.collection_name': 'hub Bo Rel',
	'bo_std.mime': 'png',
	'bo_std.filesize': '123.5 kB',
	'bo_std.map_point': '[object Object]',
	'bo_translations.translations': 'Helloinfo',
	'bo_tree.children': '2 Items',
};

let fetch: ReturnType<typeof mockFixtureApi>;
let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	// No rate limit of the app queue (5 requests per 500 ms) in tests.
	await replaceQueue();
	vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
	vi.setSystemTime(new Date('2026-10-15T00:00:00Z'));
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	warn = vi.spyOn(console, 'warn');
	error = vi.spyOn(console, 'error');
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	// No display failed (ErrorBoundary and Vue warn on console) and nothing logged an error.
	expect(warn).not.toHaveBeenCalled();
	expect(error).not.toHaveBeenCalled();
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = '';
});

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

/** The first seeded row of the field's collection, read with the display fields (FR-073). */
async function seededValue(field: FieldRaw): Promise<unknown> {
	const pk = useFieldsStore().getPrimaryKeyFieldForCollection(field.collection)!.field;
	const key = snapshot.items[field.collection]![0]![pk];
	const fields = adjustFieldsForDisplays([field.field], field.collection);
	const item = (await sdk.request(readItem(field.collection as never, key, { fields } as never))) as Record<
		string,
		unknown
	>;
	return item[field.field];
}

function renderField(field: FieldRaw, value: unknown, display = field.meta!.display) {
	return mount(RenderDisplay, {
		props: {
			display,
			options: field.meta!.display_options,
			interface: field.meta!.interface,
			interfaceOptions: field.meta!.options,
			value: value as never,
			type: field.type,
			collection: field.collection,
			field: field.field,
		},
		global: { plugins: [i18n, router] },
		attachTo: document.body,
	});
}

const text = (wrapper: { text(): string }) => wrapper.text().replace(/\s+/g, ' ').trim();
const fieldOf = (collection: string, name: string) =>
	displayFields.find((f) => f.collection === collection && f.field === name)!;

describe('every bo_* field with a display', () => {
	test('the fixture uses every registered display and the expectations cover every field', () => {
		const used = new Set(displayFields.map((field) => field.meta!.display));

		for (const { id } of getDisplays()) expect(used, id).toContain(id);
		expect(Object.keys(EXPECTED_TEXT).sort()).toEqual(displayFields.map((f) => `${f.collection}.${f.field}`).sort());
	});

	test.each(displayFields.map((field) => [`${field.collection}.${field.field}`, field] as const))(
		'%s renders the seeded value without error',
		async (key, field) => {
			const wrapper = renderField(field, await seededValue(field));

			expect(text(wrapper)).toBe(EXPECTED_TEXT[key]);
		},
	);
});

describe('US2 scenarios', () => {
	test('1: datetime relative, strict, round floor follows Directus and refreshes every 60 s', async () => {
		vi.setSystemTime(new Date('2024-03-15T07:35:30Z'));
		const field = fieldOf('bo_std', 'timestamp');
		const wrapper = renderField(field, await seededValue(field));

		expect(text(wrapper)).toBe('5 minutes ago');

		vi.advanceTimersByTime(60_000);
		await flushPromises();
		expect(text(wrapper)).toBe('6 minutes ago');
	});

	test('2: formatted-value with two matching rules takes each property from the last rule that has it', async () => {
		const field = fieldOf('bo_std', 'input_string');
		const [first, last] = field.meta!.display_options!['conditionalFormatting'];
		const wrapper = renderField(field, await seededValue(field));
		const root = wrapper.get('.display-formatted');

		// Both rules match "alpha" (eq alpha, contains alp): colors and icon of the last, text of the first.
		expect(root.attributes('style')).toContain(`background-color: ${last.background}`);
		expect(root.get('.material-symbols-rounded').text()).toBe(last.icon);
		expect(root.get('.value').text()).toBe(first.text);
	});

	test('3: labels with showAsDot shows only a colored dot whose tooltip is the choice text', async () => {
		const field = fieldOf('bo_std', 'select_dropdown');
		const wrapper = renderField(field, await seededValue(field));

		expect(wrapper.findAll('.dot')).toHaveLength(1);
		expect(wrapper.get('.dot').attributes('style')).toBe('background-color: #6644FF;'); // raw-color-allowed: Directus data default (Q-C)
		expect(wrapper.getComponent(BoTooltip).props('text')).toBe('Alpha');
		expect(wrapper.get('.display-labels').text().trim()).toBe(wrapper.get('.sr-only').text());
	});

	test('4: related-values on an m2m shows "N items" (the opened list: DisplayRelatedValues.browser.test.ts)', async () => {
		const field = fieldOf('bo_rel', 'm2m_list');
		const value = (await seededValue(field)) as Record<string, any>[];
		const trigger = renderField(field, value).get('button');

		expect(value.map((row) => row['bo_rel_target_id'].name)).toEqual(['Target one', 'Target one', 'Target five']);
		expect(trigger.text().replace(/\s+/g, ' ')).toBe('3 Items');
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
	});

	test('5: null shows ValueNull, an unknown display id shows the raw value', async () => {
		const field = fieldOf('bo_std', 'input_string');

		for (const value of [null, undefined]) {
			const wrapper = renderField(field, value);
			expect(wrapper.get('[aria-hidden="true"]').text()).toBe('--');
			expect(wrapper.get('.sr-only').text()).toBe('No value');
		}

		expect(text(renderField(field, 'alpha', 'does-not-exist'))).toBe('alpha');
	});
});

describe('handlers (FR-072)', () => {
	const HANDLERS: [string, string, string, unknown][] = [
		['collection', 'bo_std', 'collection_name', 'Bo Rel'],
		['datetime', 'bo_std', 'date', 'Mar 15, 2024'],
		['filesize', 'bo_std', 'filesize', '123.5 kB'],
		['formatted-json-value', 'bo_std', 'select_tree', 'fruit, kale'],
		['formatted-value', 'bo_std', 'input_string', '<Alpha>'],
		['labels', 'bo_std', 'select_dropdown_int', 'Two'],
		['mime-type', 'bo_std', 'mime', 'png'],
		['related-values', 'bo_rel', 'm2o', 'Target one'],
		['translations', 'bo_translations', 'translations', 'Hello'],
		['user', 'bo_rel', 'owner', 'Edith Editor'],
	];

	test('the 10 displays with a handler in Directus have one', () => {
		expect(
			getDisplays()
				.filter((display) => display.handler)
				.map((display) => display.id),
		).toEqual(HANDLERS.map(([id]) => id));
	});

	test.each(HANDLERS)('%s handler on %s.%s', async (id, collection, name, expected) => {
		const raw = fieldOf(collection, name);
		const field = useFieldsStore().getField(collection, name)!;
		const value = await seededValue(raw);

		expect(field.meta!.display).toBe(id);
		expect(
			getDisplay(id)!.handler!(value, field.meta!.display_options ?? {}, {
				interfaceOptions: field.meta!.options ?? {},
				field,
				collection,
			}),
		).toBe(expected);
	});
});

describe('display fields and aliases (FR-073)', () => {
	test('adjustFieldsForDisplays adds the fields each display needs', () => {
		const adjust = (collection: string, field: string) => adjustFieldsForDisplays([field], collection);

		expect(adjust('bo_rel', 'file')).toEqual(['file.id', 'file.type', 'file.title', 'file.modified_on']);
		expect(adjust('bo_rel', 'file_image')).toEqual([
			'file_image.id',
			'file_image.type',
			'file_image.title',
			'file_image.modified_on',
		]);
		expect(adjust('bo_rel', 'owner')).toEqual([
			'owner.id',
			'owner.avatar.id',
			'owner.avatar.modified_on',
			'owner.email',
			'owner.first_name',
			'owner.last_name',
		]);
		expect(adjust('bo_rel', 'm2o')).toEqual(['m2o.name', 'm2o.id']);
		expect(adjust('bo_rel', 'm2o_default')).toEqual(['m2o_default.id']);
		expect(adjust('bo_rel', 'm2m_list')).toEqual(['m2m_list.bo_rel_target_id.name', 'm2m_list.bo_rel_target_id.id']);
		expect(adjust('bo_rel', 'm2a')).toEqual([
			'm2a.item:bo_m2a_a.name',
			'm2a.item:bo_m2a_b.title',
			'm2a.id',
			'm2a.collection',
		]);
		expect(adjust('bo_rel', 'files')).toEqual(['files.directus_files_id.title', 'files.id']);
		expect(adjust('bo_translations', 'translations')).toEqual([
			'translations.*',
			'translations.title',
			'translations.bo_languages_code.code',
			'translations.bo_languages_code.name',
		]);
		// Fields without display fields stay as they are.
		expect(adjust('bo_std', 'input_string')).toEqual(['input_string']);
	});

	test('a field used twice is aliased and each display reads its own value', async () => {
		const { aliasedFields, aliasQuery, getFromAliasedItem } = useAliasFields(['m2o.name', 'm2o.status'], 'bo_rel');
		const fields = Object.values(aliasedFields.value).flatMap((entry) => entry.fields);

		expect(Object.values(aliasedFields.value).every((entry) => entry.aliased)).toBe(true);

		const item = (await sdk.request(
			readItem('bo_rel' as never, 1, { fields, alias: aliasQuery.value } as never),
		)) as Record<string, any>;

		expect(getFromAliasedItem(item, 'm2o.name')).toBe('Target one');
		expect(getFromAliasedItem(item, 'm2o.status')).toBe('published');
		expect(calls(fetch).at(-1)).toContain('&alias={');
	});
});
