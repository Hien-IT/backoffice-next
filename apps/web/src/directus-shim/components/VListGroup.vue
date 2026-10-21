<!-- Ported from directus/app/src/components/v-list-group.vue -->
<script setup lang="ts">
import { useGroupable } from '@directus/composables';
import { computed, inject, provide, ref, useSlots, watch } from 'vue';
import { RouterLink } from 'vue-router';
import BoIcon from '../../components/BoIcon.vue';
import { FOCUS, LIST, useRouteActive } from './list.ts';

// Backoffice (spec 020, data-model §7): open state through the `v-list` group like Directus. The activator row holds
// the main element (RouterLink with `to`, a button with `clickable` or to toggle, else a mouse target) and, with
// children, a separate arrow button (`aria-expanded`) as Directus nests a clickable v-icon in the row (a button in a
// button is invalid). Outside a list the group root is a `div`.
const props = withDefaults(
	defineProps<{
		multiple?: boolean | undefined;
		to?: string | undefined;
		active?: boolean | undefined;
		exact?: boolean | undefined;
		query?: boolean | undefined;
		disabled?: boolean | undefined;
		clickable?: boolean | undefined;
		scope?: string | undefined;
		value?: number | string | undefined;
		dense?: boolean | undefined;
		open?: boolean | undefined;
		// eslint-disable-next-line vue/require-default-prop -- no default in Directus either; any value change collapses
		collapseOnChange?: unknown;
		arrowPlacement?: 'before' | 'after' | false | undefined;
	}>(),
	{
		multiple: true,
		to: '',
		active: undefined,
		exact: false,
		query: false,
		disabled: false,
		clickable: false,
		scope: 'v-list',
		value: undefined,
		dense: false,
		open: false,
		arrowPlacement: 'after',
	},
);

const emit = defineEmits(['click']);

const slots = useSlots();

const list = inject(LIST, null);
provide(LIST, list ?? { dense: ref(false), nav: ref(false) });

const {
	active: groupableActive,
	toggle,
	deactivate,
} = useGroupable({ group: props.scope, ...(props.value === undefined ? {} : { value: props.value }) });

const groupActive = computed(() => groupableActive.value || props.open);

const isActiveRoute = useRouteActive(props);

const hasArrow = computed(() => !!slots['default'] && !!props.arrowPlacement);

const isDense = computed(() => props.dense || !!list?.dense.value);

watch(
	() => props.collapseOnChange,
	() => deactivate(),
);

function onClick(event: MouseEvent) {
	if (props.disabled || props.to) return;
	if (props.clickable) return emit('click', event);

	event.stopPropagation();
	toggle();
}

const MAIN = `flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-start ${FOCUS}`;
</script>

<template>
	<component :is="list ? 'li' : 'div'" class="v-list-group">
		<div
			class="activator flex items-center rounded-lg text-theme-sm"
			:class="[
				isActiveRoute
					? 'active bg-brand-50 text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400'
					: disabled
						? 'text-gray-400 dark:text-white/30'
						: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5',
				{ 'cursor-not-allowed': disabled },
			]"
		>
			<button
				v-if="hasArrow && arrowPlacement === 'before'"
				type="button"
				class="ms-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:text-gray-300"
				:class="FOCUS"
				:aria-label="$t('toggle')"
				:aria-expanded="groupActive"
				:disabled="disabled"
				@click.stop.prevent="toggle"
			>
				<BoIcon
					name="chevron_right"
					class="transition-transform motion-reduce:transition-none"
					:class="groupActive ? 'rotate-90' : 'rtl:rotate-180'"
				/>
			</button>

			<RouterLink
				v-if="to"
				:to="to"
				:class="[MAIN, isDense ? 'min-h-8 py-1' : 'min-h-10 py-2', { 'pointer-events-none': disabled }]"
				:aria-disabled="disabled || undefined"
			>
				<slot name="activator" :active="groupActive" />
			</RouterLink>
			<button
				v-else-if="clickable || (!hasArrow && !open)"
				type="button"
				:class="[MAIN, isDense ? 'min-h-8 py-1' : 'min-h-10 py-2', 'disabled:cursor-not-allowed']"
				:disabled="disabled"
				:aria-expanded="!clickable && $slots['default'] ? groupActive : undefined"
				@click="onClick"
			>
				<slot name="activator" :active="groupActive" />
			</button>
			<div
				v-else
				:class="[MAIN, isDense ? 'min-h-8 py-1' : 'min-h-10 py-2', { 'cursor-pointer': !disabled }]"
				@click="onClick"
			>
				<slot name="activator" :active="groupActive" />
			</div>

			<button
				v-if="hasArrow && arrowPlacement === 'after'"
				type="button"
				class="me-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:text-gray-300"
				:class="FOCUS"
				:aria-label="$t('toggle')"
				:aria-expanded="groupActive"
				:disabled="disabled"
				@click.stop.prevent="toggle"
			>
				<BoIcon
					name="chevron_right"
					class="transition-transform motion-reduce:transition-none"
					:class="groupActive ? 'rotate-90' : 'rtl:rotate-180'"
				/>
			</button>
		</div>

		<ul v-if="groupActive" class="items flex flex-col gap-0.5 ps-4 pt-0.5">
			<slot />
		</ul>
	</component>
</template>
