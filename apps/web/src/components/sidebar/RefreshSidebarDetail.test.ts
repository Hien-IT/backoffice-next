// Ported from directus/app/src/views/private/components/refresh-sidebar-detail.test.ts
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { emitter, Events } from '../../events.ts';
import { i18n } from '../../lang/index.ts';
import { useSidebarStore } from '../../layout/stores/sidebar.ts';
import BoSelect from '../BoSelect.vue';
import RefreshSidebarDetail from './RefreshSidebarDetail.vue';

// Backoffice: the real mitt emitter and i18n; SidebarDetail and BoSelect are rendered (Pinia for the sidebar store).

describe('refresh-sidebar-detail timer lifecycle', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		useSidebarStore().activeAccordionItem = 'refresh';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('clears interval on unmount', () => {
		const wrapper = mount(RefreshSidebarDetail, {
			props: { modelValue: 30 },
			global: { plugins: [i18n] },
		});

		// Spy created after mount — only captures calls from onUnmounted
		const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
		wrapper.unmount();

		expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
	});

	it('does not emit refresh after unmount', async () => {
		const refreshSpy = vi.fn();

		const Parent = defineComponent({
			components: { RefreshSidebarDetail },
			setup() {
				return { refreshSpy };
			},
			template: '<RefreshSidebarDetail :model-value="10" @refresh="refreshSpy" />',
		});

		const wrapper = mount(Parent, { global: { plugins: [i18n] } });
		wrapper.unmount();

		vi.advanceTimersByTime(15_000);

		// After unmount the interval should be gone — no refresh calls
		expect(refreshSpy).not.toHaveBeenCalled();
	});

	// Backoffice: cases below cover the interval, the idle/active pause and the select (FR-099).
	it('emits refresh every interval', () => {
		const wrapper = mount(RefreshSidebarDetail, { props: { modelValue: 10 }, global: { plugins: [i18n] } });

		vi.advanceTimersByTime(25_000);

		expect(wrapper.emitted('refresh')).toHaveLength(2);
		wrapper.unmount();
	});

	it('pauses on tabIdle, refreshes at once and resumes on tabActive', () => {
		const wrapper = mount(RefreshSidebarDetail, { props: { modelValue: 10 }, global: { plugins: [i18n] } });

		emitter.emit(Events.tabIdle);
		vi.advanceTimersByTime(30_000);
		expect(wrapper.emitted('refresh')).toBeUndefined();

		emitter.emit(Events.tabActive);
		expect(wrapper.emitted('refresh')).toHaveLength(1);

		vi.advanceTimersByTime(10_000);
		expect(wrapper.emitted('refresh')).toHaveLength(2);
		wrapper.unmount();
	});

	it('does not refresh on tabActive without an interval', () => {
		const wrapper = mount(RefreshSidebarDetail, { props: { modelValue: null }, global: { plugins: [i18n] } });

		emitter.emit(Events.tabActive);
		vi.advanceTimersByTime(600_000);

		expect(wrapper.emitted('refresh')).toBeUndefined();
		wrapper.unmount();
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
