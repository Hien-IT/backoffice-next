// Spec 020 T111: VTemplateInput (marks, trigger and navigation events, escaped text), VFieldTemplate (field buttons
// from the value, field menu on the tree, removal, nullable) and VCollectionFieldTemplate (tree of a collection),
// VEmojiPicker (emoji-selected from the DR picker).
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import FieldList from '../../components/FieldList.vue';
import type { FieldNode } from '../../composables/use-field-tree.ts';
import { i18n } from '../../lang/index.ts';
import VCollectionFieldTemplate from './VCollectionFieldTemplate.vue';
import VEmojiPicker from './VEmojiPicker.vue';
import VFieldTemplate from './VFieldTemplate.vue';
import VTemplateInput from './VTemplateInput.vue';

const picker = vi.hoisted(() => ({
	listeners: {} as Record<string, (event: { emoji: string }) => void>,
	toggle: vi.fn(),
	theme: vi.fn(),
	destroy: vi.fn(),
}));

vi.mock('@joeattardi/emoji-button', () => ({
	EmojiButton: class {
		on(event: string, callback: (event: { emoji: string }) => void) {
			picker.listeners[event] = callback;
		}
		togglePicker = picker.toggle;
		setTheme = picker.theme;
		destroyPicker = picker.destroy;
	},
}));

enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/', component: { render: () => null } }],
});
const global = { plugins: [i18n, router] };

/** Caret at the end of the editable element. */
function caretAtEnd(el: HTMLElement) {
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	window.getSelection()!.removeAllRanges();
	window.getSelection()!.addRange(range);
}

describe('VTemplateInput', () => {
	const props = { captureGroup: '(@[a-z]+)', triggerCharacter: '@', items: { ada: 'Ada Lovelace' } };

	test('a textbox; known matches become marks with the item text; markup in the value stays text', async () => {
		const wrapper = mount(VTemplateInput, {
			props: { ...props, modelValue: 'Hi @ada <img src=x>', placeholder: 'Type' },
			attrs: { 'aria-label': 'Template' },
			attachTo: document.body,
		});
		await flushPromises();

		expect(wrapper.attributes()).toMatchObject({
			role: 'textbox',
			'aria-label': 'Template',
			'aria-placeholder': 'Type',
		});
		expect(wrapper.get('mark.preview').attributes('data-preview')).toBe('Ada Lovelace');
		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.text()).toContain('<img src=x>');
	});

	test('typing the trigger emits trigger and the value; arrows and Enter emit while triggered; deactivate', async () => {
		const wrapper = mount(VTemplateInput, { props, attachTo: document.body });
		const el = wrapper.element as HTMLElement;

		el.innerText = 'Hi @ad';
		caretAtEnd(el);
		await wrapper.trigger('input');

		expect(wrapper.emitted('trigger')?.[0]?.[0]).toMatchObject({ searchQuery: 'ad' });
		// The match is marked at once, between no-break spaces (DR parseHTML).
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Hi\u00a0@ad\u00a0']);
		expect(wrapper.find('mark.preview').exists()).toBe(true);

		await wrapper.trigger('keydown', { code: 'ArrowDown' });
		await wrapper.trigger('keydown', { code: 'ArrowUp' });
		await wrapper.trigger('keydown', { code: 'Enter' });
		expect(wrapper.emitted('down')).toHaveLength(1);
		expect(wrapper.emitted('up')).toHaveLength(1);
		expect(wrapper.emitted('enter')).toHaveLength(1);

		el.innerText = 'Hi there';
		caretAtEnd(el);
		await wrapper.trigger('input');
		expect(wrapper.emitted('deactivate')).toHaveLength(1);
	});
});

const tree: FieldNode[] = [
	{ name: 'Title', field: 'title', collection: 'posts', key: 'title', path: 'title', type: 'string' },
	{
		name: 'Author',
		field: 'author',
		collection: 'posts',
		relatedCollection: 'users',
		key: 'author',
		path: 'author',
		type: 'uuid',
		children: [
			{ name: 'Email', field: 'email', collection: 'users', key: 'author.email', path: 'author.email', type: 'string' },
		],
	},
];

describe('VFieldTemplate', () => {
	test('the value renders text spans and field buttons; loadPathLevel is asked for each level of a path', async () => {
		const loadPathLevel = vi.fn();
		const wrapper = mount(VFieldTemplate, {
			props: { tree, modelValue: 'By {{author.email}}', loadPathLevel },
			attrs: { 'aria-label': 'Display template' },
			global,
		});
		await flushPromises();

		const textbox = wrapper.get('[role="textbox"]');
		expect(textbox.attributes('aria-label')).toBe('Display template');
		expect(textbox.get('button.selected-field').attributes('data-field')).toBe('author.email');
		expect(textbox.text()).toBe('By Email');
		expect(loadPathLevel).toHaveBeenCalledWith('author');
	});

	test('clicking a field removes it; an empty value is null when nullable', async () => {
		const wrapper = mount(VFieldTemplate, {
			props: { tree, modelValue: '{{title}}' },
			global,
			attachTo: document.body,
		});
		await flushPromises();

		await wrapper.get('button.selected-field').trigger('click');
		expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['']);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
	});

	test('the menu lists the tree (depth) and adds the chosen field; disabled closes everything', async () => {
		const wrapper = mount(VFieldTemplate, {
			props: { tree, modelValue: null, depth: 0, placeholder: 'Pick fields' },
			global,
			attachTo: document.body,
		});
		await flushPromises();

		expect(wrapper.text()).toContain('Pick fields');
		await wrapper.get('button[aria-label="Add Field"]').trigger('click');
		await flushPromises();

		const list = wrapper.getComponent(FieldList);
		expect(list.props()).toMatchObject({ fieldTree: tree, depth: 0 });
		expect(document.body.querySelectorAll('[role="treeitem"][aria-expanded]')).toHaveLength(0);

		list.vm.$emit('add', ['title']);
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['{{title}}']);

		await wrapper.setProps({ disabled: true });
		expect(wrapper.get('[role="textbox"]').attributes('contenteditable')).toBe('false');
		expect(wrapper.get('button[aria-label="Add Field"]').attributes('disabled')).toBeDefined();
	});
});

describe('VCollectionFieldTemplate', () => {
	test('a notice without collection, else the field template with the attributes', async () => {
		const wrapper = mount(VCollectionFieldTemplate, {
			props: { collection: null },
			attrs: { 'aria-label': 'Template' },
			global,
		});

		expect(wrapper.text()).toContain('Select a Collection');
		await wrapper.setProps({ collection: 'posts', modelValue: 'x', placeholder: 'P' });
		const template = wrapper.getComponent(VFieldTemplate);
		expect(template.props()).toMatchObject({ modelValue: 'x', placeholder: 'P', tree: [] });
		expect(template.get('[role="textbox"]').attributes('aria-label')).toBe('Template');

		template.vm.$emit('update:modelValue', 'y');
		expect(wrapper.emitted('update:modelValue')).toEqual([['y']]);
	});
});

describe('VEmojiPicker', () => {
	test('a named button toggles the picker in the app theme; a picked emoji is emitted; destroyed on unmount', async () => {
		document.documentElement.classList.add('dark');
		const wrapper = mount(VEmojiPicker, { global });
		const button = wrapper.get('button');

		expect(button.attributes('aria-label')).toBe('Insert emoji');
		await button.trigger('click');
		expect(picker.theme).toHaveBeenCalledWith('dark');
		expect(picker.toggle).toHaveBeenCalledWith(button.element);

		picker.listeners['emoji']!({ emoji: '🎉' });
		expect(wrapper.emitted('emoji-selected')).toEqual([['🎉']]);

		wrapper.unmount();
		expect(picker.destroy).toHaveBeenCalled();
		document.documentElement.classList.remove('dark');
	});
});
