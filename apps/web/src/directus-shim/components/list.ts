// Ported from directus/app/src/components/v-list-item.vue (isActiveRoute)
// Backoffice (spec 020, data-model §7): shared by the VList shims. VList (and the items `ul` of VListGroup) provide
// LIST, so an item knows it sits in a `ul` (its link or button then gets an `li` around it, a `ul` may only hold `li`)
// and reads the list's `dense` / `nav`.
import { isMatch } from 'lodash-es';
import { computed, inject, type InjectionKey, type Ref } from 'vue';
import { routerKey, useLink, type RouteLocationRaw } from 'vue-router';

export const LIST: InjectionKey<{ dense: Ref<boolean>; nav: Ref<boolean> }> = Symbol('v-list');

export const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

/** DR isActiveRoute: the `active` prop wins, else the `to` route matches (exactly with `exact`, query with `query`). */
export function useRouteActive(props: {
	to?: string | RouteLocationRaw | undefined;
	active?: boolean | undefined;
	exact?: boolean | undefined;
	query?: boolean | undefined;
}) {
	// Without a router (unit tests, a shim used outside the app) only the `active` prop counts.
	const router = inject(routerKey, null);
	const link = router ? useLink({ to: computed(() => props.to || '') }) : null;

	return computed(() => {
		if (props.active !== undefined) return props.active;
		if (!props.to || !link || !router) return false;

		const current = router.currentRoute.value.query;
		const target = link.route.value.query;
		const queryMatch = Object.values(target).length ? isMatch(current, target) : !Object.values(current).length;

		return (props.exact ? link.isExactActive.value : link.isActive.value) && (!props.query || queryMatch);
	});
}
