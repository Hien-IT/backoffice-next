// Ported from directus/app/src/layouts/index.ts
// Backoffice: no global `layout-<id>` components; the screens render `getLayout(id).component` and its slots (research R4).
import { sortBy } from 'lodash-es';
import { type Component, defineComponent, h } from 'vue';
import BoNotice from '../components/BoNotice.vue';
import ErrorBoundary from '../components/render/ErrorBoundary.vue';
import { i18n } from '../lang/index.ts';
import type { LayoutConfig } from './types.ts';

const modules = import.meta.glob<LayoutConfig>('./*/index.ts', { import: 'default', eager: true });

const internal: LayoutConfig[] = sortBy(Object.values(modules), 'id');

let layouts = internal;

export function getInternalLayouts(): LayoutConfig[] {
	return [...internal];
}

/** An extension layout part that throws shows the unexpected_error notice instead of breaking the screen (FR-067). */
function guarded(name: string, component: Component): Component {
	return defineComponent({
		name: `${name}-guard`,
		inheritAttrs: false,
		setup(_props, { attrs, slots }) {
			return () =>
				h(
					ErrorBoundary,
					{ name },
					{
						default: () => h(component, attrs, slots),
						fallback: () => h(BoNotice, { type: 'warning' }, () => i18n.global.t('unexpected_error')),
					},
				);
		},
	});
}

/** Spec 020 (FR-064): the internal layouts and those of app extensions; the screens render the layouts directly, so
 * the error boundary of extension layouts is set here. */
export function registerLayouts(list: LayoutConfig[]): void {
	layouts = sortBy(
		list.map((layout) => {
			if (internal.includes(layout)) return layout;
			const slots = Object.fromEntries(
				Object.entries(layout.slots).map(([key, slot]) => [key, slot && guarded(`layout-${layout.id}-${key}`, slot)]),
			) as LayoutConfig['slots'];
			return { ...layout, component: guarded(`layout-${layout.id}`, layout.component), slots };
		}),
		'id',
	);
}

export function getLayouts(): LayoutConfig[] {
	return layouts;
}

export function getLayout(id: string | null | undefined): LayoutConfig | undefined {
	return layouts.find((layout) => layout.id === id);
}
