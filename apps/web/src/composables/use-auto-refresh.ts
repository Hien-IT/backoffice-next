// Backoffice: the timer of DR refresh-sidebar-detail.vue. The detail panel is a popover (owner 2026-10-20) that
// unmounts its details while closed, so the page runs the timer and RefreshSidebarDetail only picks the interval.
import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import { emitter, Events } from '../events.ts';

// A count, not a boolean: the next page can mount before the previous one unmounts.
const activeCount = ref(0);

/** A page has an auto refresh interval set (the D-199 dot on the detail panel toggle, DetailPanel.vue). */
export const autoRefreshActive = computed(() => activeCount.value > 0);

export function useAutoRefresh(interval: Ref<number | null>, refresh: () => unknown) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let counted = false;

	const setCounted = (value: boolean) => {
		if (value !== counted) activeCount.value += value ? 1 : -1;
		counted = value;
	};

	const setRefreshInterval = (value: number | null) => {
		clearInterval(timer);
		setCounted(!!value && value > 0);

		if (!value || value <= 0) return;

		timer = setInterval(() => refresh(), value * 1000);
	};

	const onIdle = () => clearInterval(timer);

	const onActive = () => {
		if (interval.value && interval.value > 0) refresh();
		setRefreshInterval(interval.value);
	};

	emitter.on(Events.tabIdle, onIdle);
	emitter.on(Events.tabActive, onActive);

	onUnmounted(() => {
		clearInterval(timer);
		setCounted(false);
		emitter.off(Events.tabIdle, onIdle);
		emitter.off(Events.tabActive, onActive);
	});

	watch(interval, setRefreshInterval, { immediate: true });
}
