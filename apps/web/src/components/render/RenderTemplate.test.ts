// Directus has no test for render-template.vue (spec FR-071): template parts, displays per field, arrays, $thumbnail,
// m2a `field:collection`, literal translation, render errors.
import type { Field, Relation } from '@directus/types';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import RenderTemplate from './RenderTemplate.vue';
import { FAKE_DISPLAYS } from './test-displays.ts';

vi.mock('../../displays/index.ts', () => ({ getDisplay: (id: string | null) => (id ? FAKE_DISPLAYS[id] : undefined) }));

beforeEach(() => {
	setActivePinia(createPinia());
});

function field(name: string, type: string, meta: Record<string, unknown> = {}, collection = 'articles'): Field {
	return { collection, field: name, name, type, schema: null, meta: { display: null, display_options: null, ...meta } } as unknown as Field;
}

function mountTemplate(props: Record<string, unknown> & { template: string }) {
	return mount(RenderTemplate, { props, global: { plugins: [i18n] } });
}

describe('RenderTemplate', () => {
	test('renders literal text, translated `$t:` literals and the direction', () => {
		const wrapper = mountTemplate({ template: '$t:save', direction: 'rtl' });

		expect(wrapper.text()).toBe('Save');
		expect(wrapper.get('span[dir]').attributes('dir')).toBe('rtl');
	});

	test('a value without a field definition is shown raw, a missing value is ValueNull', () => {
		const wrapper = mountTemplate({ template: '{{ title }} - {{ missing }}', item: { title: 'Hello' } });

		expect(wrapper.text()).toBe('Hello - --No value');
	});

	test('uses the display of the field, the default display for its type, and raw without overhead', () => {
		const wrapper = mountTemplate({
			template: '{{ a }} {{ b }} {{ c }} {{ d }}',
			item: { a: 'x', b: 1, c: 'z', d: 'w' },
			fields: [
				field('a', 'string', { display: 'fake', display_options: { suffix: '!' } }),
				field('b', 'integer'),
				field('c', 'string', { display: 'raw' }),
				field('d', 'string', { display: 'badge' }),
			],
		});

		expect(wrapper.findAll('.fake').map((el) => el.text())).toEqual(['"x"!', '[1]']);
		expect(wrapper.text()).toContain('z');
		expect(wrapper.text()).toContain('w');
	});

	test('array displays get the whole array, other displays one component per value', () => {
		const wrapper = mountTemplate({
			template: '{{ tags }}|{{ dates }}',
			item: { tags: ['a', 'b'], dates: ['2026-01-01', '2026-01-02'] },
			fields: [field('tags', 'csv', { display: 'related-values' }), field('dates', 'date', { display: 'datetime' })],
		});

		expect(wrapper.findAll('.fake').map((el) => el.text())).toEqual(['["a","b"]', '"2026-01-01"', '"2026-01-02"']);
	});

	test('uses the fields store when a collection is given, including $thumbnail of directus_files', () => {
		useFieldsStore().fields = [
			field('title', 'string', { display: 'fake' }),
			field('$thumbnail', 'integer', { display: 'file' }, 'directus_files'),
		];

		expect(mountTemplate({ template: '{{ title }}', collection: 'articles', item: { title: 'T' } }).text()).toBe('"T"');

		const file = { id: 'f1', type: 'image/png' };
		const thumbnail = mountTemplate({ template: '{{ $thumbnail }}', collection: 'directus_files', item: file });
		expect(thumbnail.get('.fake').text()).toBe(JSON.stringify(file));
	});

	test('m2a `field:collection` parts only read items of that collection', () => {
		useFieldsStore().fields = [field('item', 'string', { special: ['m2a'] }, 'junction')];

		useRelationsStore().relations = [
			{
				collection: 'junction',
				field: 'item',
				related_collection: null,
				meta: { one_collection_field: 'collection', one_allowed_collections: ['posts', 'pages'] },
			} as unknown as Relation,
		];

		const item = { collection: 'posts', item: { title: 'Post title' } };

		expect(mountTemplate({ template: '{{ item:posts.title }}', collection: 'junction', item }).text()).toBe(
			'Post title',
		);

		expect(mountTemplate({ template: '{{ item:pages.title }}', collection: 'junction', item }).text()).toBe(
			'--No value',
		);
	});

	test('a display that throws falls back to the value', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const wrapper = mountTemplate({
			template: 'A {{ a }}',
			item: { a: 'kept' },
			fields: [field('a', 'string', { display: 'broken' })],
		});

		await nextTick();
		expect(wrapper.text()).toBe('A kept');
		warn.mockRestore();
	});
});
