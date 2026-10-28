// Ported from directus/app/src/views/private/private-view/stores/nav-bar.ts
// Backoffice: state of the TailAdmin sidebar (design-system layout-patterns, L-1): `collapsed` is the inline sidebar
// from `xl` (290 px or the 90 px rail, TailAdmin `isExpanded`), saved under the backoffice- key (Principle IX) with
// storage errors kept in memory (useLayoutStorage); below `xl` the sidebar is a drawer whose `drawerOpen` (TailAdmin
// `isMobileOpen`) is never saved. Owner 2026-10-28: the inline column is resizable like the DR nav column, its width
// saved in `backoffice-nav-bar-size` (DR `nav-bar-size`), 240 to 480 px.
import { createEventHook } from '@vueuse/core';
import { clamp } from 'lodash-es';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLayoutBreakpoints } from '../../composables/use-media-query.ts';
import { useLayoutStorage } from './sidebar.ts';

export const NAV_BAR_SIZE = { default: 290, min: 240, max: 480 } as const;

export const useNavBarStore = defineStore('nav-bar-store', () => {
	const collapsed = useLayoutStorage('backoffice-nav-bar-collapsed', false);

	const storedSize = useLayoutStorage('backoffice-nav-bar-size', NAV_BAR_SIZE.default);

	const size = computed({
		get: () =>
			Number.isFinite(storedSize.value)
				? clamp(storedSize.value, NAV_BAR_SIZE.min, NAV_BAR_SIZE.max)
				: NAV_BAR_SIZE.default,
		set(val: number) {
			if (Number.isFinite(val)) storedSize.value = clamp(Math.round(val), NAV_BAR_SIZE.min, NAV_BAR_SIZE.max);
		},
	});
	const drawerOpen = ref(false);

	const route = useRoute();
	const { xl: inlineNav } = useLayoutBreakpoints();

	// The drawer closes on navigation and when the window grows to `xl`.
	watch([() => route.fullPath, inlineNav], () => {
		drawerOpen.value = false;
	});

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
		drawerOpen,
		inlineNav,
		collapse,
		expand,
		toggle,
		onCollapse: collapseHook.on,
		onExpand: expandHook.on,
	};
});
