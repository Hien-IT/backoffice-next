// Spec 020 T111: axe (wcag2a/aa, wcag21a/aa; serious and critical) on the select, upload and template group of the
// shim (VSelect in its modes, VFancySelect, VUpload, VTemplateInput, VFieldTemplate, VCollectionFieldTemplate,
// VEmojiPicker), light and `html.dark`, with the grouped select list open; keyboard choice in VSelect.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, test } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import '../styles/theme-vars.css';
import VCollectionFieldTemplate from './VCollectionFieldTemplate.vue';
import VEmojiPicker from './VEmojiPicker.vue';
import VFancySelect from './VFancySelect.vue';
import VFieldTemplate from './VFieldTemplate.vue';
import VSelect from './VSelect.vue';
import VTemplateInput from './VTemplateInput.vue';
import VUpload from './VUpload.vue';

enableAutoUnmount(afterEach);
afterEach(() => document.documentElement.classList.remove('dark'));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
});

const items = [
	{ text: 'Draft', value: 'draft', icon: 'edit' },
	{ text: 'Published', value: 'published', color: 'var(--theme--primary)' },
	{ divider: true },
	{
		text: 'Archive',
		value: 'archive',
		children: [
			{ text: 'Old', value: 'old' },
			{ text: 'Older', value: 'older' },
		],
	},
];

const tree = [
	{ name: 'Title', field: 'title', collection: 'posts', key: 'title', path: 'title', type: 'string' as const },
];

const label = (id: string, text: string) =>
	h('label', { for: id, class: 'block text-sm text-gray-700 dark:text-gray-300' }, text);

const Page = defineComponent({
	setup() {
		const status = ref<string | null>('draft');
		const tags = ref<string[] | null>(['a']);
		const fancy = ref<string | null>(null);
		const template = ref('Hi @ada');
		const display = ref<string | null>('{{title}}');

		return () =>
			h('main', { class: 'space-y-4 bg-white p-4 dark:bg-gray-900' }, [
				label('status', 'Status'),
				h(VSelect, {
					id: 'status',
					items,
					itemIcon: 'icon',
					itemColor: 'color',
					showDeselect: true,
					modelValue: status.value,
					'onUpdate:modelValue': (value: string | null) => (status.value = value),
				}),
				h(VSelect, { items, inline: true, label: true, modelValue: status.value }),
				label('tags', 'Tags'),
				h(VSelect, {
					id: 'tags',
					items: ['a', 'b', 'c'],
					multiple: true,
					modelValue: tags.value,
					'onUpdate:modelValue': (value: string[] | null) => (tags.value = value),
				}),
				h(VFancySelect, {
					items: [
						{ icon: 'star', text: 'Star', value: 'star', description: 'Shiny' },
						{ icon: 'bolt', text: 'Bolt', value: 'bolt', description: 'Fast' },
					],
					modelValue: fancy.value,
					'onUpdate:modelValue': (value: string | null) => (fancy.value = value),
				}),
				h(VUpload, { fromUrl: true, fromLibrary: true }),
				h(VTemplateInput, {
					'aria-label': 'Message',
					captureGroup: '(@[a-z]+)',
					triggerCharacter: '@',
					items: { ada: 'Ada Lovelace' },
					modelValue: template.value,
					'onUpdate:modelValue': (value: string) => (template.value = value),
				}),
				h(VFieldTemplate, {
					'aria-label': 'Display template',
					tree,
					modelValue: display.value,
					'onUpdate:modelValue': (value: string | null) => (display.value = value),
				}),
				h(VCollectionFieldTemplate, { collection: null }),
				h(VEmojiPicker),
			]);
	},
});

// While a select list is open, Reka hides the rest of the page (aria-hidden, modal list): only the list is checked then.
async function violations(context: Element = document.body): Promise<string[]> {
	const results = await axe.run(context, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

const mountPage = () => mount(Page, { attachTo: document.body, global: { plugins: [createPinia(), router, i18n] } });

describe('group B2 shims', () => {
	test.each(['light', 'dark'])('no serious or critical axe violation, the grouped list open (%s)', async (theme) => {
		if (theme === 'dark') document.documentElement.classList.add('dark');
		const wrapper = mountPage();
		await flushPromises();

		expect(await violations()).toEqual([]);

		(wrapper.get('#status').element as HTMLElement).focus();
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => document.querySelector('[role="listbox"] [role="group"]')).not.toBeNull();

		expect(await violations(document.querySelector('[role="listbox"]')!)).toEqual([]);
		await userEvent.keyboard('{Escape}');
	});

	test('keyboard: the select opens with Enter, arrows move, Enter chooses a group child; focus comes back', async () => {
		const wrapper = mountPage();
		await flushPromises();
		const trigger = wrapper.get('#status').element as HTMLElement;

		trigger.focus();
		await userEvent.keyboard('{Enter}');
		await expect.poll(() => document.querySelector('[role="listbox"]')).not.toBeNull();
		await userEvent.keyboard('{End}');
		await userEvent.keyboard('{Enter}');

		await expect.poll(() => trigger.textContent).toContain('Older');
		expect(document.activeElement).toBe(trigger);
	});

	test('keyboard: Tab reaches the inline select, the upload actions, the textboxes and the emoji button', async () => {
		mountPage();
		await flushPromises();

		const reached: string[] = [];

		for (let index = 0; index < 14; index++) {
			await userEvent.tab();
			const active = document.activeElement as HTMLElement;
			reached.push(active.getAttribute('aria-label') ?? (active.id || active.getAttribute('aria-haspopup') || ''));
		}

		expect(reached).toEqual(
			expect.arrayContaining([
				'status',
				'listbox',
				'tags',
				'Options',
				'Message',
				'Display template',
				'Add Field',
				'Insert emoji',
			]),
		);
	});
});
