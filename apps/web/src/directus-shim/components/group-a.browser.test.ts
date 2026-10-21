// Spec 020 T110: axe (wcag2a/aa, wcag21a/aa; serious and critical) on the button and icon group of the shim
// (VButton, VIcon, VChip, VBadge, VAvatar, VIconFile, VImage, VHighlight, VHover), light and `html.dark`, and keyboard
// access to the interactive ones.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, test } from 'vitest';
import { defineComponent, h, type VNode } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import VAvatar from './VAvatar.vue';
import VBadge from './VBadge.vue';
import VButton from './VButton.vue';
import VChip from './VChip.vue';
import VHighlight from './VHighlight.vue';
import VHover from './VHover.vue';
import VIcon from './VIcon.vue';
import VIconFile from './VIconFile.vue';
import VImage from './VImage.vue';

enableAutoUnmount(afterEach);
afterEach(() => document.documentElement.classList.remove('dark'));

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
});

const text = 'text-gray-700 dark:text-gray-300';
const button = (props: Record<string, unknown>, label: string | (() => VNode)) =>
	h(VButton, props, () => (typeof label === 'string' ? label : label()));

const Page = defineComponent({
	render: () =>
		h('main', { class: 'space-y-4 bg-white p-4 dark:bg-gray-900' }, [
			h('div', { class: 'flex flex-wrap gap-2' }, [
				button({}, 'Save'),
				button({ secondary: true }, 'Cancel'),
				button({ kind: 'danger' }, 'Delete'),
				button({ kind: 'info', small: true }, 'Info'),
				button({ kind: 'success', large: true }, 'Done'),
				button({ kind: 'warning', xSmall: true }, 'Careful'),
				button({ outlined: true }, 'Outlined'),
				button({ outlined: true, kind: 'danger' }, 'Outlined danger'),
				button({ dashed: true, fullWidth: true, align: 'left' }, 'Add'),
				button({ icon: true, rounded: true, secondary: true, tooltip: 'Edit' }, () => h(VIcon, { name: 'edit' })),
				button({ disabled: true }, 'Disabled'),
				button({ loading: true }, 'Loading'),
				button({ to: '/content', outlined: true }, 'Link'),
				button({ href: 'https://example.org' }, 'External'),
			]),
			h('p', { class: text }, [
				h(VIcon, { name: 'star', filled: true }),
				h(VIcon, { name: 'close', clickable: true }),
				h(VIcon, { name: 'info', sup: true }),
			]),
			h('div', { class: 'flex flex-wrap gap-2' }, [
				h(VChip, null, () => 'Draft'),
				h(VChip, { label: false, outlined: true, small: true }, () => 'Small'),
				h(VChip, { close: true }, () => 'Removable'),
				h(VChip, { clickable: true, large: true }, () => 'Clickable'),
			]),
			h('div', { class: 'flex gap-4' }, [
				h(VBadge, { value: 3 }, () => button({ secondary: true }, 'Inbox')),
				h(VBadge, { dot: true, bordered: true }, () => h(VAvatar, null, () => 'AL')),
				h(VAvatar, { tile: true, border: true, small: true }, () =>
					h(VImage, { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Ada' }),
				),
				h(
					VAvatar,
					{ clickable: true, 'aria-label': 'Open profile', xLarge: true, border: 'var(--theme--primary)' },
					() => 'AL',
				),
				h(VIconFile, { ext: 'pdf' }),
			]),
			h('p', { class: text }, [h(VHighlight, { text: 'Crème brûlée', query: 'cre' })]),
			h(VHover, null, {
				default: ({ hover }: { hover: boolean }) => h('span', { class: text }, hover ? 'Hovered' : 'Hover me'),
			}),
		]),
});

async function violations(): Promise<string[]> {
	const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } });

	return results.violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.html.slice(0, 200)}`));
}

const mountPage = () => mount(Page, { attachTo: document.body, global: { plugins: [createPinia(), router, i18n] } });

describe('group A shims', () => {
	test.each(['light', 'dark'])('no serious or critical axe violation (%s)', async (theme) => {
		if (theme === 'dark') document.documentElement.classList.add('dark');
		mountPage();
		await flushPromises();

		expect(await violations()).toEqual([]);
	});

	test('keyboard: Tab reaches the buttons, links, clickable icon, chip and avatar; Enter clicks', async () => {
		const wrapper = mountPage();
		await flushPromises();

		const focusable = wrapper.findAll('button:not([disabled]), a[href]').map((w) => w.element);
		const reached: Element[] = [];

		for (let index = 0; index < focusable.length; index++) {
			await userEvent.tab();
			reached.push(document.activeElement!);
		}

		expect(reached).toEqual(focusable);

		const close = wrapper.get('button[aria-label="close"]');
		(close.element as HTMLElement).focus();
		const clicks: Event[] = [];
		close.element.addEventListener('click', (event) => clicks.push(event));
		await userEvent.keyboard('{Enter}');
		expect(clicks).toHaveLength(1);
	});
});
