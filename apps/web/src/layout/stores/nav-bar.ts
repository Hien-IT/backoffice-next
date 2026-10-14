// Ported from directus/app/src/views/private/private-view/stores/nav-bar.ts
// Backoffice: localStorage keys with the backoffice- prefix (Principle IX), storage errors kept in memory
// (useLayoutStorage); breakpoints from composables/use-media-query.ts.
import { createEventHook } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLayoutBreakpoints } from '../../composables/use-media-query.ts';
import { useLayoutStorage, useSidebarStore } from './sidebar.ts';

export const useNavBarStore = defineStore('nav-bar-store', () => {
	const collapsed = useLayoutStorage('backoffice-nav-bar-collapsed', false);

	const DEFAULT_SIZE = 225;
	const storedSize = useLayoutStorage('backoffice-nav-bar-size', DEFAULT_SIZE);

	const size = computed({
		get() {
			const val = storedSize.value;

			if (!Number.isFinite(val)) {
				storedSize.value = DEFAULT_SIZE;
				return DEFAULT_SIZE;
			}

			return val;
		},
		set(val: number) {
			if (Number.isFinite(val)) storedSize.value = val;
		},
	});

	const route = useRoute();
	const { lg, xl } = useLayoutBreakpoints();
	const sidebarStore = useSidebarStore();

	const inlineNav = computed(() => {
		return sidebarStore.collapsed ? lg.value : xl.value;
	});

	watch(
		() => route.fullPath,
		() => {
			if (!inlineNav.value) collapse();
		},
	);

	const collapseHook = createEventHook();
	const expandHook = createEventHook();

	const collapse = () => {
		if (collapsed.value === true) return;
		collapsed.value = true;
		collapseHook.trigger();
	};

	const expand = () => {
		if (collapsed.value === false) return;
		collapsed.value = false;
		expandHook.trigger();
	};

	const toggle = () => {
		if (collapsed.value === true) expand();
		else collapse();
	};

	return {
		collapsed,
		size,
		// Backoffice: exposed so PrivateView and HeaderBar share the rule of private-view-root.vue.
		inlineNav,
		collapse,
		expand,
		toggle,
		onCollapse: collapseHook.on,
		onExpand: expandHook.on,
	};
});
