import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, expect, test } from 'vitest';
import { h, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import '../styles/theme-vars.css';
import VCard from './VCard.vue';
import VCardActions from './VCardActions.vue';
import VCardSubtitle from './VCardSubtitle.vue';
import VCardText from './VCardText.vue';
import VCardTitle from './VCardTitle.vue';
import VDetail from './VDetail.vue';
import VDivider from './VDivider.vue';
import VList from './VList.vue';
import VListGroup from './VListGroup.vue';
import VListItem from './VListItem.vue';
import VListItemContent from './VListItemContent.vue';
import VListItemHint from './VListItemHint.vue';
import VListItemIcon from './VListItemIcon.vue';
import VSheet from './VSheet.vue';
import VTab from './VTab.vue';
import VTabItem from './VTabItem.vue';
import VTabs from './VTabs.vue';
import VTabsItems from './VTabsItems.vue';

enableAutoUnmount(afterEach);

async function serious(el: Element) {
	const { violations } = await axe.run(el, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} ${v.nodes.map((n) => n.html + n.failureSummary).join('|')}`);
}

// An extension page mixing the group: tabs with panels, a list with a group, a card, a detail, a divider and a sheet.
const Page = {
	setup() {
		const tab = ref<(string | number)[]>(['list']);
		const open = ref<(string | number)[]>(['fruit']);

		return () =>
			h('div', { class: 'space-y-4 p-4' }, [
				h(VTabs, { modelValue: tab.value, 'onUpdate:modelValue': (v: string[]) => (tab.value = v) }, () => [
					h(VTab, { value: 'list' }, () => 'List'),
					h(VTab, { value: 'card' }, () => 'Card'),
					h(VTab, { value: 'off', disabled: true }, () => 'Off'),
				]),
				h(VTabsItems, { modelValue: tab.value }, () => [
					h(VTabItem, { value: 'list' }, () =>
						h(
							VList,
							{ mandatory: false, modelValue: open.value, 'onUpdate:modelValue': (v: string[]) => (open.value = v) },
							() => [
								h(VListItem, { clickable: true, active: true }, () => [
									h(VListItemIcon, () => '•'),
									h(VListItemContent, () => 'Active item'),
									h(VListItemHint, () => 'Hint'),
								]),
								h(VListItem, { href: 'https://example.com' }, () => h(VListItemContent, () => 'External')),
								h(VListItem, { clickable: true, disabled: true }, () => h(VListItemContent, () => 'Disabled')),
								h(
									VListGroup,
									{ value: 'fruit' },
									{
										activator: () => h(VListItemContent, () => 'Fruit'),
										default: () => h(VListItem, null, () => h(VListItemContent, () => 'Apple')),
									},
								),
							],
						),
					),
					h(VTabItem, { value: 'card' }, () =>
						h(VCard, () => [
							h(VCardTitle, () => 'Title'),
							h(VCardSubtitle, () => 'Subtitle'),
							h(VCardText, () => 'Card text'),
							h(VCardActions, () => h('button', { type: 'button' }, 'OK')),
						]),
					),
				]),
				h(VDivider, null, { icon: () => h('span', { 'aria-hidden': 'true' }, '★'), default: () => 'Section' }),
				h(VDetail, { label: 'More', startOpen: true }, () => h(VSheet, () => 'Sheet content')),
			]);
	},
};

test('tabs keyboard and axe (light and dark) on the list, tab, card, detail, divider and sheet shims', async () => {
	const wrapper = mount(Page, { attachTo: document.body, global: { plugins: [i18n] } });
	const tabs = () => wrapper.findAll('[role="tab"]').map((tab) => tab.element as HTMLElement);

	await userEvent.tab();
	expect(document.activeElement).toBe(tabs()[0]);
	await userEvent.keyboard('{ArrowRight}');
	expect(document.activeElement).toBe(tabs()[1]);
	expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
	expect(wrapper.text()).toContain('Card text');
	// Off is disabled: Right wraps to the first tab.
	await userEvent.keyboard('{ArrowRight}');
	expect(document.activeElement).toBe(tabs()[0]);
	expect(wrapper.text()).toContain('Apple');

	// The group arrow is a real button.
	await userEvent.click(wrapper.get('button[aria-expanded="true"][aria-label="Toggle"]').element);
	expect(wrapper.text()).not.toContain('Apple');
	await userEvent.click(wrapper.get('button[aria-expanded="false"][aria-label="Toggle"]').element);

	const noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; }';
	try {
		expect(await serious(wrapper.element)).toEqual([]);
		document.documentElement.classList.add('dark');
		expect(await serious(wrapper.element)).toEqual([]);

		await userEvent.click(tabs()[1]!);
		document.documentElement.classList.remove('dark');
		expect(await serious(wrapper.element)).toEqual([]);
		document.documentElement.classList.add('dark');
		expect(await serious(wrapper.element)).toEqual([]);
	} finally {
		document.documentElement.classList.remove('dark');
		noTransitions.remove();
	}
});
