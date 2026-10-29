// Timer cases of directus/app/src/views/private/components/refresh-sidebar-detail.test.ts, on the page composable.
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { emitter, Events } from '../events.ts';
import { autoRefreshActive, useAutoRefresh } from './use-auto-refresh.ts';

function mountPage(value: number | null) {
	const refresh = vi.fn();
	const interval = ref(value);

	const wrapper = mount(
		defineComponent({
			setup() {
				useAutoRefresh(interval, refresh);
				return () => null;
			},
		}),
	);

	return { wrapper, refresh, interval };
}

describe('useAutoRefresh', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('clears interval on unmount', () => {
		const { wrapper } = mountPage(30);

		// Spy created after mount — only captures calls from onUnmounted
		const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
		wrapper.unmount();

		expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
	});

	it('does not refresh after unmount', () => {
		const { wrapper, refresh } = mountPage(10);
		wrapper.unmount();

		vi.advanceTimersByTime(15_000);

		expect(refresh).not.toHaveBeenCalled();
	});

	it('refreshes every interval', () => {
		const { wrapper, refresh } = mountPage(10);

		vi.advanceTimersByTime(25_000);

		expect(refresh).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('follows a new interval and stops without one', async () => {
		const { wrapper, refresh, interval } = mountPage(null);

		interval.value = 30;
		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(30_000);
		expect(refresh).toHaveBeenCalledTimes(1);

		interval.value = null;
		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(600_000);
		expect(refresh).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('pauses on tabIdle, refreshes at once and resumes on tabActive', () => {
		const { wrapper, refresh } = mountPage(10);

		emitter.emit(Events.tabIdle);
		vi.advanceTimersByTime(30_000);
		expect(refresh).not.toHaveBeenCalled();

		emitter.emit(Events.tabActive);
		expect(refresh).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(10_000);
		expect(refresh).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('does not refresh on tabActive without an interval', () => {
		const { wrapper, refresh } = mountPage(null);

		emitter.emit(Events.tabActive);
		vi.advanceTimersByTime(600_000);

		expect(refresh).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('marks auto refresh active while a mounted page has an interval', async () => {
		const first = mountPage(30);
		const second = mountPage(null);
		expect(autoRefreshActive.value).toBe(true);

		second.interval.value = 10;
		await Promise.resolve();
		first.wrapper.unmount();
		expect(autoRefreshActive.value).toBe(true);

		second.interval.value = null;
		await Promise.resolve();
		expect(autoRefreshActive.value).toBe(false);

		second.interval.value = 60;
		await Promise.resolve();
		second.wrapper.unmount();
		expect(autoRefreshActive.value).toBe(false);
	});
});
