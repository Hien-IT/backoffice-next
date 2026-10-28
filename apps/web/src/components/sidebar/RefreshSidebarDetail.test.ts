// Ported from directus/app/src/views/private/components/refresh-sidebar-detail.test.ts
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoSelect from '../BoSelect.vue';
import RefreshSidebarDetail from './RefreshSidebarDetail.vue';

// Backoffice: the real i18n; SidebarDetail and BoSelect are rendered (Pinia for the sidebar store). The timer cases
// moved to composables/use-auto-refresh.test.ts with the timer.

describe('refresh-sidebar-detail', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useSidebarStore().activeAccordionItem = 'refresh';
	});

	it('lists the intervals and writes the chosen one', async () => {
		const wrapper = mount(RefreshSidebarDetail, { props: { modelValue: null }, global: { plugins: [i18n] } });
		const select = wrapper.findComponent(BoSelect);

		expect(select.props('modelValue')).toBe('none');
		expect(select.props('items')).toEqual([
			{ text: 'Do not refresh', value: 'none' },
			{ text: 'Every 10 Seconds', value: '10' },
			{ text: 'Every 30 Seconds', value: '30' },
			{ text: 'Every Minute', value: '60' },
			{ text: 'Every 5 Minutes', value: '300' },
		]);

		select.vm.$emit('update:modelValue', '60');
		select.vm.$emit('update:modelValue', 'none');

		expect(wrapper.emitted('update:modelValue')).toEqual([[60], [null]]);
		wrapper.unmount();
	});
});
