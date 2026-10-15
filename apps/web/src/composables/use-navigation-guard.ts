// Ported from directus/app/src/composables/use-navigation-guard.ts
import { useEventListener } from '@vueuse/core';
import type { Ref } from 'vue';
import { type NavigationGuard, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

export function useNavigationGuard(locked: Ref<boolean>, guard: NavigationGuard) {
	useEventListener(document, 'beforeunload', (event) => {
		if (locked.value) event.preventDefault();
	});

	onBeforeRouteUpdate(guard);
	onBeforeRouteLeave(guard);
}
