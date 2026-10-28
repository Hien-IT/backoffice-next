// Backoffice: the timer of DR refresh-sidebar-detail.vue. The detail panel is a popover (owner 2026-10-20) that
// unmounts its details while closed, so the page runs the timer and RefreshSidebarDetail only picks the interval.
import { onUnmounted, watch, type Ref } from 'vue';
import { emitter, Events } from '../events.ts';

export function useAutoRefresh(interval: Ref<number | null>, refresh: () => unknown) {
	let timer: ReturnType<typeof setInterval> | undefined;

	const setRefreshInterval = (value: number | null) => {
		clearInterval(timer);

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
		emitter.off(Events.tabIdle, onIdle);
		emitter.off(Events.tabActive, onActive);
	});

	watch(interval, setRefreshInterval, { immediate: true });
}
