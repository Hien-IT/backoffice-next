// Ported from directus/app/src/views/private/private-view/stores/sidebar.ts
// Backoffice: localStorage keys with the backoffice- prefix (Principle IX); storage that cannot be used (blocked,
// private mode) keeps the value in memory; activeAccordionItem is left out (no sidebar details in 012, D-45).
import { createEventHook, useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, type Ref, watch } from 'vue';

/** useLocalStorage that never throws: without usable storage the ref only lives in memory. */
export function useLayoutStorage(key: string, defaultValue: boolean): Ref<boolean>;
export function useLayoutStorage(key: string, defaultValue: number): Ref<number>;
export function useLayoutStorage(key: string, defaultValue: boolean | number): Ref<boolean | number> {
	// useStorage catches a throwing `window.localStorage` getter (useLocalStorage reads it before the try).
	return useStorage(key, defaultValue, undefined, { onError: () => {} });
}

export const useSidebarStore = defineStore('sidebar-store', () => {
	const collapsed = useLayoutStorage('backoffice-sidebar-collapsed', false);

	const DEFAULT_SIZE = 333;
	const storedSize = useLayoutStorage('backoffice-sidebar-size', DEFAULT_SIZE);

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

	watch(collapsed, (newCollapsed) => {
		if (newCollapsed) {
			collapseHook.trigger();
		} else {
			expandHook.trigger();
		}
	});

	const collapseHook = createEventHook();
	const expandHook = createEventHook();

	const collapse = () => {
		if (collapsed.value === true) return;
		collapsed.value = true;
	};

	const expand = () => {
		if (collapsed.value === false) return;
		collapsed.value = false;
	};

	const toggle = () => {
		if (collapsed.value === true) expand();
		else collapse();
	};

	return {
		collapsed,
		size,
		collapse,
		expand,
		toggle,
		onCollapse: collapseHook.on,
		onExpand: expandHook.on,
	};
});
