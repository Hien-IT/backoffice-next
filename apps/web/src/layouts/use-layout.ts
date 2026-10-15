// Ported from directus/packages/composables/src/use-layout.ts
// Backoffice: the layouts come from `getLayouts()` (no extensions store); the wrappers are built once per layout.
import type { Filter } from '@directus/types';
import type { Component, ComputedRef, PropType, Ref } from 'vue';
import { computed, defineComponent, reactive, toRefs } from 'vue';
import { getLayouts } from './index.ts';
import type { LayoutConfig, ShowSelect } from './types.ts';

const NAME_SUFFIX = 'wrapper';
const WRITABLE_PROPS = ['selection', 'layoutOptions', 'layoutQuery'] as const;

type WritableProp = (typeof WRITABLE_PROPS)[number];

export function isWritableProp(prop: string): prop is WritableProp {
	return (WRITABLE_PROPS as readonly string[]).includes(prop);
}

export function createLayoutWrapper<Options, Query>(layout: LayoutConfig): Component {
	return defineComponent({
		name: `${layout.id}-${NAME_SUFFIX}`,
		props: {
			collection: {
				type: String,
				required: true,
			},
			selection: {
				type: Array as PropType<(number | string)[]>,
				default: () => [],
			},
			layoutOptions: {
				type: Object as PropType<Options>,
				default: () => ({}),
			},
			layoutQuery: {
				type: Object as PropType<Query>,
				default: () => ({}),
			},
			layoutProps: {
				type: Object as PropType<any>,
				default: () => ({}),
			},
			filter: {
				type: Object as PropType<Filter>,
				default: null,
			},
			filterUser: {
				type: Object as PropType<Filter>,
				default: null,
			},
			filterSystem: {
				type: Object as PropType<Filter>,
				default: null,
			},
			search: {
				type: String as PropType<string | null>,
				default: null,
			},
			showSelect: {
				type: String as PropType<ShowSelect>,
				default: 'multiple',
			},
			selectMode: {
				type: Boolean,
				default: false,
			},
			readonly: {
				type: Boolean,
				default: false,
			},
			resetPreset: {
				type: Function as PropType<() => Promise<void>>,
				default: null,
			},
			clearFilters: {
				type: Function as PropType<() => void>,
				default: null,
			},
		},
		emits: WRITABLE_PROPS.map((prop) => `update:${prop}` as const),
		setup(props, { emit }) {
			const state: Record<string, unknown> = reactive({
				...layout.setup(props as any, { emit }),
				...toRefs(props),
				sidebarShadow: layout.sidebarShadow ?? false,
			});

			for (const key in state) {
				state[`onUpdate:${key}`] = (value: unknown) => {
					if (isWritableProp(key)) {
						emit(`update:${key}`, value);
					} else if (!Object.keys(props).includes(key)) {
						state[key] = value;
					}
				};
			}

			return { state };
		},
		render(ctx: any) {
			return ctx.$slots.default !== undefined ? ctx.$slots.default({ layoutState: ctx.state }) : null;
		},
	});
}

const wrappers = new Map<string, Component>();

function wrapperOf(layout: LayoutConfig): Component {
	let wrapper = wrappers.get(layout.id);

	if (!wrapper) {
		wrapper = createLayoutWrapper(layout);
		wrappers.set(layout.id, wrapper);
	}

	return wrapper;
}

export function useLayout<Options = any, Query = any>(
	layoutId: Ref<string | null>,
	layouts: () => LayoutConfig[] = getLayouts,
): { layoutWrapper: ComputedRef<Component> } {
	const layoutWrapper = computed(() => {
		const all = layouts();
		const layout = all.find((layout) => layout.id === layoutId.value) ?? all.find((layout) => layout.id === 'tabular');

		return wrapperOf(layout as LayoutConfig<Options, Query>);
	});

	return { layoutWrapper };
}
