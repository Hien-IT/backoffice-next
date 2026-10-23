// DR has no test for the related-values display (spec FR-072, FR-073, FR-074 `related-values`, FR-078): inline
// m2o, "N item(s)" trigger for the to-many types, units, `fields`, `options` and `handler` on the fixture relations.
import { readItem } from '@directus/sdk';
import type { ExtensionOptionsContext } from '@directus/types';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { replaceQueue, sdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { fieldsOf, itemOf, loadSnapshot } from '../../test-utils/fixtures.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import DisplayRelatedValues from './DisplayRelatedValues.vue';
import display from './index.ts';

const fieldsFn = display.fields as (
	options: Record<string, unknown> | null,
	context: Record<string, string>,
) => string[];

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
	document.body.innerHTML = '';
});

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: {} }] });

function mountDisplay(props: Record<string, unknown>, attachTo?: HTMLElement) {
	return mount(DisplayRelatedValues, {
		props: { collection: 'bo_rel', ...props } as never,
		global: { plugins: [i18n, router] },
		attachTo: attachTo ?? document.body,
	});
}

const options = (field: string) => fieldsOf('bo_rel').find((f) => f.field === field)!.meta!.display_options ?? {};
const text = (wrapper: { text(): string }) => wrapper.text().replace(/\s+/g, ' ').trim();

/** The bo_rel row read with the display fields, as a layout would read it. */
async function fetched(field: string) {
	const fields = adjustFieldsForDisplays([field], 'bo_rel');
	const item = (await sdk.request(readItem('bo_rel' as never, 1, { fields } as never))) as Record<string, any>;
	return item[field];
}

describe('m2o', () => {
	test('fixture field: the template renders inline, without a menu', () => {
		const wrapper = mountDisplay({ field: 'm2o', value: itemOf('bo_rel', 1)['m2o'], ...options('m2o') });

		expect(text(wrapper)).toBe('Target one');
		expect(wrapper.find('button').exists()).toBe(false);
	});

	test('option:related-values.template defaults to the primary key of the related collection', () => {
		expect(text(mountDisplay({ field: 'm2o_default', value: itemOf('bo_rel', 1)['m2o_default'] }))).toBe('2');
	});

	test('option:related-values.template renders each field with its own display', () => {
		const wrapper = mountDisplay({
			field: 'm2o',
			value: itemOf('bo_rel', 1)['m2o'],
			template: '{{ name }} - {{ status }}',
		});

		// `status` uses the labels display of bo_rel_target.
		expect(text(wrapper)).toBe('Target one - Published');
	});

	test('a field without relation shows ValueNull', () => {
		const wrapper = mount(DisplayRelatedValues, {
			props: { collection: 'bo_rel', field: 'title', value: { id: 1 } },
			global: { plugins: [i18n, router] },
		});

		expect(wrapper.get('.sr-only').text()).toBe('No value');
	});
});

describe('to-many fields show "N item(s)"', () => {
	test.each([
		['o2m_list', '2 Items'],
		['m2m_list', '3 Items'],
		['m2a', '2 Items'],
		['files', '2 Items'],
	])('%s: %s on a popover trigger', async (field, label) => {
		const trigger = mountDisplay({ field, value: await fetched(field), ...options(field) }).get('button');

		expect(text(trigger)).toBe(label);
		expect(trigger.attributes('aria-haspopup')).toBe('dialog');
		expect(trigger.attributes('aria-expanded')).toBe('false');
		expect(trigger.attributes('disabled')).toBeUndefined();
	});

	test('one item is singular, 100 or more get a "+", none disables the trigger', () => {
		const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Row ${i}` }));

		expect(text(mountDisplay({ field: 'o2m_list', value: rows(1) }).get('button'))).toBe('1 Item');
		expect(text(mountDisplay({ field: 'o2m_list', value: rows(100) }).get('button'))).toBe('100 + Items');

		const empty = mountDisplay({ field: 'o2m_list', value: [] }).get('button');
		expect(text(empty)).toBe('0 Items');
		expect(empty.attributes('disabled')).toBeDefined();
	});

	test('the unit uses the collection name translations when they exist', () => {
		const messages = { ...i18n.global.getLocaleMessage('en-US') };
		i18n.global.mergeLocaleMessage('en-US', {
			collection_names_singular: { bo_rel_target: 'Target' },
			collection_names_plural: { bo_rel_target: 'Targets' },
		});

		try {
			expect(text(mountDisplay({ field: 'o2m_list', value: [{ id: 1 }] }).get('button'))).toBe('1 Target');
			expect(text(mountDisplay({ field: 'o2m_list', value: [{ id: 1 }, { id: 2 }] }).get('button'))).toBe('2 Targets');
		} finally {
			i18n.global.setLocaleMessage('en-US', messages);
		}
	});

	test('the trigger click does not reach a parent (table row)', async () => {
		let parentClicks = 0;
		const host = document.createElement('div');
		host.addEventListener('click', () => parentClicks++);
		document.body.append(host);

		await mountDisplay({ field: 'o2m_list', value: [{ id: 1 }] }, host)
			.get('button')
			.trigger('click');
		expect(parentClicks).toBe(0);
	});
});

describe('index', () => {
	test('fields(): template fields adjusted for displays, plus the primary key (and the m2a collection field)', () => {
		const fields = (field: string, template?: string) =>
			fieldsFn(template ? { template } : null, { collection: 'bo_rel', field, type: 'alias' });

		expect(fields('m2o', '{{ name }}')).toEqual(['name', 'id']);
		expect(fields('m2o')).toEqual(['id']);
		expect(fields('o2m_list', '{{ name }}')).toEqual(['name', 'id']);
		expect(fields('m2m_list', '{{ bo_rel_target_id.name }}')).toEqual(['bo_rel_target_id.name', 'bo_rel_target_id.id']);
		expect(fields('m2a', '{{ item:bo_m2a_a.name }}')).toEqual(['item:bo_m2a_a.name', 'id', 'collection']);
		expect(fields('files', '{{ directus_files_id.title }}')).toEqual(['directus_files_id.title', 'id']);
		// A template field with a display gets that display's fields.
		expect(
			fieldsFn({ template: '{{ owner }}' }, { collection: 'bo_rel_target', field: 'o2m_list_parent', type: 'integer' }),
		).toEqual([
			'owner.id',
			'owner.avatar.id',
			'owner.avatar.modified_on',
			'owner.email',
			'owner.first_name',
			'owner.last_name',
			'id',
		]);
		expect(fields('title')).toEqual([]);
	});

	test('options(): template notice while creating the field, display template on the related collection after', () => {
		const optionsFn = display.options as (context: ExtensionOptionsContext) => any[];

		expect(optionsFn({ editing: '+', relations: {} } as never)[0].meta).toEqual({
			interface: 'presentation-notice',
			options: { text: '$t:displays.related-values.display_template_configure_notice' },
			width: 'full',
		});
		expect(optionsFn({ editing: 'm2o', relations: { m2o: { related_collection: 'bo_rel_target' } } } as never)).toEqual(
			[
				{
					field: 'template',
					name: '$t:display_template',
					meta: { interface: 'system-display-template', options: { collectionName: 'bo_rel_target' }, width: 'full' },
				},
			],
		);
		expect(
			optionsFn({ editing: 'o2m_list', relations: { o2m: { collection: 'bo_rel_target' } } } as never)[0].meta.options,
		).toEqual({ collectionName: 'bo_rel_target' });
	});

	test('handler(): renders the template with the nested display handlers', () => {
		const context = (field: string) => ({
			collection: 'bo_rel',
			field: useFieldsStore().getField('bo_rel', field)!,
		});
		const m2o = itemOf('bo_rel', 1)['m2o'];

		expect(display.handler!(m2o, { template: '{{ name }}' }, context('m2o'))).toBe('Target one');
		// `status` has the labels display, whose handler gives the choice text (none here: the value).
		expect(display.handler!(m2o, { template: '{{ name }} ({{ status }})' }, context('m2o'))).toBe(
			'Target one (published)',
		);
		expect(display.handler!(m2o, { template: '{{ name }}' }, {})).toBe(m2o);
		expect(display.handler!('x', { template: '{{ name }}' }, context('title'))).toBe('x');
	});
});
