import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import SidebarDetail from './SidebarDetail.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	localStorage.clear();
	setActivePinia(createPinia());
});

const Panel = defineComponent({
	props: { badge: { type: null, default: undefined } },
	setup:
		(props, { attrs }) =>
		() => [
			h(SidebarDetail, { id: 'info', title: 'Information', icon: 'info', badge: props.badge, ...attrs }, () =>
				h('p', { 'data-body': 'info' }, 'Info body'),
			),
			h(SidebarDetail, { id: 'revisions', title: 'Revisions', icon: 'change_history' }, () =>
				h('p', { 'data-body': 'revisions' }, 'Revisions body'),
			),
		],
});

function setup(props: Record<string, unknown> = {}) {
	return mount(Panel, { props, global: { plugins: [i18n] } });
}

const expanded = (wrapper: ReturnType<typeof setup>) =>
	wrapper.findAll('h3 > button').map((button) => button.attributes('aria-expanded'));

describe('SidebarDetail', () => {
	test('header buttons show the title and are closed by default', () => {
		const wrapper = setup();

		expect(wrapper.findAll('h3 > button').map((b) => b.text())).toEqual([
			'infoInformationexpand_more',
			'change_historyRevisionsexpand_more',
		]);
		expect(expanded(wrapper)).toEqual(['false', 'false']);
		expect(wrapper.find('[data-body]').exists()).toBe(false);
	});

	test('opening one section closes the other through activeAccordionItem', async () => {
		const wrapper = setup();
		const store = useSidebarStore();
		const [info, revisions] = wrapper.findAll('h3 > button');

		await info!.trigger('click');
		expect(store.activeAccordionItem).toBe('info');
		expect(expanded(wrapper)).toEqual(['true', 'false']);
		expect(wrapper.find('[data-body]').text()).toBe('Info body');

		await revisions!.trigger('click');
		expect(store.activeAccordionItem).toBe('revisions');
		expect(expanded(wrapper)).toEqual(['false', 'true']);
		expect(wrapper.find('[data-body]').text()).toBe('Revisions body');

		await revisions!.trigger('click');
		expect(store.activeAccordionItem).toBeNull();
		expect(expanded(wrapper)).toEqual(['false', 'false']);
	});

	test('emits toggle when its section opens or closes, also from the store', async () => {
		const wrapper = setup();
		const store = useSidebarStore();
		const [info, revisions] = wrapper.findAllComponents(SidebarDetail);

		store.activeAccordionItem = 'info';
		await nextTick();
		store.activeAccordionItem = 'revisions';
		await nextTick();

		expect(info!.emitted('toggle')).toEqual([[true], [false]]);
		expect(revisions!.emitted('toggle')).toEqual([[true]]);
		expect(expanded(wrapper)).toEqual(['false', 'true']);
	});

	test('badge: a count chip, or a dot when true', async () => {
		const wrapper = setup({ badge: 3 });
		expect(wrapper.find('h3 > button').text()).toContain('3');

		await wrapper.setProps({ badge: true });
		expect(wrapper.find('h3 > button span.rounded-full.size-2').exists()).toBe(true);
	});
});
