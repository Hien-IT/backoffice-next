// Ported from directus/app/src/views/private/private-view/stores/nav-bar.ts
// Backoffice: state of the TailAdmin sidebar (design-system layout-patterns, L-1): `collapsed` is the inline sidebar
// from `xl` (290 px or the 90 px rail, TailAdmin `isExpanded`), saved under the backoffice- key (Principle IX) with
// storage errors kept in memory (useLayoutStorage); below `xl` the sidebar is a drawer whose `drawerOpen` (TailAdmin
// `isMobileOpen`) is never saved. No resizable nav column, so no size.
import { createEventHook } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLayoutBreakpoints } from '../../composables/use-media-query.ts';
import { useLayoutStorage } from './sidebar.ts';

export const useNavBarStore = defineStore('nav-bar-store', () => {
	const collapsed = useLayoutStorage('backoffice-nav-bar-collapsed', false);
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
		drawerOpen,
		inlineNav,
		collapse,
		expand,
		toggle,
		onCollapse: collapseHook.on,
		onExpand: expandHook.on,
	};
});
