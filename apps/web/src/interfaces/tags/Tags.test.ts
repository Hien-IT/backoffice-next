// Ported from directus/app/src/interfaces/tags/tags.test.ts
// Backoffice: custom tags are BoTagsInput items (named "Remove <tag>" delete buttons) and presets are toggle buttons;
// the DR cases are kept, then the option, fixture, emitted-value and a11y checks of contracts/tests.md §5 (FR-027).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { computed } from 'vue';
import { FORM_FIELD_A11Y } from '../../components/form/types.ts';
import { i18n } from '../../lang/index.ts';
import { fieldsOf, itemOf } from '../../test-utils/fixtures.ts';
import config from './index.ts';
import Tags from './Tags.vue';

enableAutoUnmount(afterEach);

const global = { plugins: [i18n] };

type Wrapper = ReturnType<typeof mount<typeof Tags>>;

const customChips = (wrapper: Wrapper) => wrapper.findAll('[aria-label^="Remove"]');
const presetChips = (wrapper: Wrapper) => wrapper.findAll('.presets .tag');

describe('Variable mode', () => {
	it('renders variable string as readonly input with clear button, no chips', () => {
		const wrapper = mount(Tags, { props: { value: '{{$trigger.payload.id}}', rawEditorEnabled: true }, global });

		expect(wrapper.find('input[disabled]').exists()).toBe(true);
		expect((wrapper.find('input[disabled]').element as HTMLInputElement).value).toBe('{{$trigger.payload.id}}');
		expect(wrapper.find('.remove-variable').exists()).toBe(true);
		expect(customChips(wrapper).length).toBe(0);
	});

	it('pressing Enter in variable mode does not add a tag', async () => {
		const wrapper = mount(Tags, { props: { value: '{{$trigger.payload.id}}', rawEditorEnabled: true }, global });

		await wrapper.find('input[disabled]').trigger('keydown', { key: 'Enter' });

		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('clicking clear button emits empty value and exits variable mode', async () => {
		const wrapper = mount(Tags, { props: { value: '{{$trigger.payload.id}}', rawEditorEnabled: true }, global });

		await wrapper.find('.remove-variable').trigger('click');
		await wrapper.setProps({ value: null });

		expect(wrapper.emitted('input')).toBeTruthy();
		expect(wrapper.emitted('input')![0]).toEqual([null]);
		expect(wrapper.find('input[disabled]').exists()).toBe(false);
	});

	it('any string value triggers variable mode when rawEditorEnabled', () => {
		const wrapper = mount(Tags, { props: { value: 'foo', rawEditorEnabled: true }, global });

		expect(wrapper.find('input[disabled]').exists()).toBe(true);
	});

	it('string value without rawEditorEnabled stays in normal tags mode', () => {
		const wrapper = mount(Tags, { props: { value: '{{$trigger.payload.id}}' }, global });

		expect(wrapper.find('input[disabled]').exists()).toBe(false);
	});

	it('null or array value stays in normal tags mode', () => {
		const wrapper1 = mount(Tags, { props: { value: null }, global });
		const wrapper2 = mount(Tags, { props: { value: ['a', 'b'] }, global });

		expect(wrapper1.find('input[disabled]').exists()).toBe(false);
		expect(wrapper2.find('input[disabled]').exists()).toBe(false);
	});
});

describe('Interface', () => {
	const presets = ['Tag 1', 'Tag 2', 'Tag 3'];
	const value = ['Value 1', 'Value 2'];

	it('should mount', () => {
		const wrapper = mount(Tags, { props: { value: null }, global });

		expect(wrapper.exists()).toBe(true);
	});

	it('should render custom tags', () => {
		const wrapper = mount(Tags, { props: { value, presets }, global });

		expect(customChips(wrapper).length).toBe(2);
	});

	it('should render preset tags', () => {
		const wrapper = mount(Tags, { props: { value: null, presets }, global });

		expect(wrapper.find('.presets').exists()).toBe(true);
		expect(presetChips(wrapper).length).toBe(3);
	});

	it('should render tags disabled when disabled is true', () => {
		const wrapper = mount(Tags, { props: { value, presets, disabled: true }, global });

		presetChips(wrapper).forEach((chip) => {
			expect(chip.attributes('disabled')).toBe('');
		});
		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
	});
});

// Backoffice: contracts/tests.md §5.
describe('Backoffice', () => {
	function mountField(name: string, value: unknown, extra: Record<string, unknown> = {}) {
		const field = fieldsOf('bo_std').find((f) => f.field === name)!;

		return mount(Tags, {
			props: { ...(field.meta?.options ?? {}), type: field.type, value, ...extra } as never,
			global,
			attachTo: document.body,
		});
	}

	async function addTag(wrapper: Wrapper, text: string) {
		const input = wrapper.get('input');
		await input.setValue(text);
		input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
		await flushPromises();
	}

	it('is registered with the Directus config', () => {
		expect(config).toMatchObject({ id: 'tags', icon: 'local_offer', types: ['json', 'csv'] });
		expect(config.component).toBe(Tags);
	});

	it('shows the seeded fixture values without emitting', () => {
		const item = itemOf('bo_std', 1);
		const json = mountField('tags', item['tags']);
		const csv = mountField('tags_csv', item['tags_csv']);

		expect(customChips(json).map((chip) => chip.attributes('aria-label'))).toEqual(['Remove custom-tag']);
		expect(json.get('.presets [aria-pressed="true"]').text()).toContain('alpha');
		expect(csv.findAll('.presets [aria-pressed="true"]').map((chip) => chip.text())).toEqual(['check ONE', 'check TWO']);
		expect(json.emitted('input')).toBeUndefined();
		expect(csv.emitted('input')).toBeUndefined();
	});

	it('missing options use the component defaults (allowCustom true, iconRight local_offer)', () => {
		const wrapper = mount(Tags, { props: { value: null }, global });

		expect(wrapper.find('input').exists()).toBe(true);
		expect(wrapper.text()).toContain('local_offer');
		expect(wrapper.get('input').attributes('placeholder')).toBe('Add a tag and press Enter...');
	});

	it('option:tags.placeholder, option:tags.iconLeft, option:tags.iconRight', () => {
		const wrapper = mount(Tags, {
			props: { value: null, placeholder: 'Add a tag', iconLeft: 'sell', iconRight: 'label' },
			global,
		});

		expect(wrapper.get('input').attributes('placeholder')).toBe('Add a tag');
		expect(wrapper.text()).toContain('sell');
		expect(wrapper.text()).toContain('label');
		expect(wrapper.text()).not.toContain('local_offer');
	});

	it('option:tags.capitalization, option:tags.whitespace, option:tags.alphabetize', async () => {
		const wrapper = mountField('tags', ['alpha']);

		await addTag(wrapper, '  Zeta  Two ');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['alpha', 'zeta-two']]);

		await addTag(wrapper, 'Beta');
		// lowercase + alphabetize: 'beta' is a preset, kept in sorted order with the custom tags.
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['alpha', 'beta', 'zeta-two']]);

		const upper = mount(Tags, { props: { value: null, capitalization: 'uppercase', whitespace: '_' }, global });
		await addTag(upper, 'a b');
		expect(upper.emitted('input')?.at(-1)).toEqual([['A_B']]);

		const none = mount(Tags, { props: { value: null, whitespace: '' }, global });
		await addTag(none, 'a b c');
		expect(none.emitted('input')?.at(-1)).toEqual([['abc']]);

		const title = mount(Tags, { props: { value: null, capitalization: 'auto-format' }, global });
		await addTag(title, 'hello world');
		expect(title.emitted('input')?.at(-1)).toEqual([['Hello World']]);
	});

	it('duplicates are removed after processing', async () => {
		const wrapper = mount(Tags, { props: { value: ['foo'], capitalization: 'lowercase' }, global });

		await addTag(wrapper, 'FOO');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['foo']]);
	});

	it('option:tags.presets toggles a preset on and off', async () => {
		const wrapper = mountField('tags', ['alpha', 'custom-tag']);
		const beta = presetChips(wrapper).find((chip) => chip.text() === 'beta')!;

		expect(beta.attributes('aria-pressed')).toBe('false');
		await beta.trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['alpha', 'beta', 'custom-tag']]);

		await presetChips(wrapper)
			.find((chip) => chip.text().includes('alpha'))!
			.trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['beta', 'custom-tag']]);
	});

	it('option:tags.allowCustom false hides the input and drops values outside the presets (csv emits an array)', async () => {
		const wrapper = mountField('tags_csv', ['ONE', 'OTHER']);

		expect(wrapper.find('input').exists()).toBe(false);
		expect(customChips(wrapper).length).toBe(0);

		await presetChips(wrapper)
			.find((chip) => chip.text() === 'TWO')!
			.trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['ONE', 'TWO']]);
	});

	it('removing a custom tag emits the remaining tags', async () => {
		const wrapper = mountField('tags', ['alpha', 'custom-tag']);

		// Reka registers the tag items after mount.
		await flushPromises();
		await wrapper.get('[aria-label="Remove custom-tag"]').trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([['alpha']]);
	});

	it('removing the last tag emits an empty array, as Directus', async () => {
		const wrapper = mount(Tags, { props: { value: ['x'] }, global, attachTo: document.body });

		await flushPromises();
		await wrapper.get('[aria-label="Remove x"]').trigger('click');
		expect(wrapper.emitted('input')?.at(-1)).toEqual([[]]);
	});

	it('follows value changes and null from the parent', async () => {
		const wrapper = mount(Tags, { props: { value: ['a'] }, global });

		await wrapper.setProps({ value: ['b', 'c'] });
		expect(customChips(wrapper).length).toBe(2);
		await wrapper.setProps({ value: null });
		expect(customChips(wrapper).length).toBe(0);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	it('a value with a template string inside the array is shown as a custom tag', () => {
		const wrapper = mountField('tags', itemOf('bo_std', 3)['tags']);

		expect(customChips(wrapper).map((chip) => chip.attributes('aria-label'))).toEqual(['Remove {{-$current_user-}}']);
	});

	it('nonEditable disables the input and the presets', () => {
		const wrapper = mountField('tags', ['alpha'], { nonEditable: true, disabled: true });

		expect(wrapper.get('input').attributes('disabled')).toBeDefined();
		presetChips(wrapper).forEach((chip) => expect(chip.attributes('disabled')).toBeDefined());
	});

	it('direction sets dir', () => {
		expect(mount(Tags, { props: { value: null, direction: 'rtl' }, global }).attributes('dir')).toBe('rtl');
	});

	it('links the input (or the preset group) to the field label, note/error and invalid state', async () => {
		const a11y = computed(() => ({ inputId: 'f-tags', labelId: 'f-tags-label', describedBy: 'f-tags-error', invalid: true }));
		const provide = { [FORM_FIELD_A11Y as symbol]: a11y };
		const wrapper = mount(Tags, { props: { value: null }, global: { plugins: [i18n], provide } });
		await flushPromises();

		expect(wrapper.get('input').attributes('id')).toBe('f-tags');
		expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('input').attributes('aria-describedby')).toBe('f-tags-error');

		const presetsOnly = mount(Tags, {
			props: { value: null, presets: ['a'], allowCustom: false },
			global: { plugins: [i18n], provide },
		});
		const group = presetsOnly.get('[role="group"]');
		expect(group.attributes('aria-labelledby')).toBe('f-tags-label');
		expect(group.attributes('aria-describedby')).toBe('f-tags-error');

		const variable = mount(Tags, {
			props: { value: '{{ x }}', rawEditorEnabled: true },
			global: { plugins: [i18n], provide },
		});
		expect(variable.get('input').attributes()).toMatchObject({
			id: 'f-tags',
			'aria-describedby': 'f-tags-error',
			'aria-invalid': 'true',
		});
	});
});
