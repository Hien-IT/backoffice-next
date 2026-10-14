<!-- Ported from directus/app/src/components/v-drawer.vue -->
<script lang="ts">
import type { InjectionKey } from 'vue';

/** Depth of the enclosing drawer: a nested drawer has a transparent overlay so the page dims once. */
export const BO_DRAWER_DEPTH: InjectionKey<number> = Symbol('bo-drawer-depth');
</script>

<script setup lang="ts">
// Backoffice: layout-patterns §8 Drawer recipe (nháp, 013) on a Reka Dialog instead of v-dialog + v-overlay; the
// header is v-drawer-header.vue folded in. Reka gives the focus trap, scroll lock, aria-hidden siblings and the focus
// return to the element focused before opening; nested drawers are separate DialogRoots and Reka only lets the top
// layer react to Esc and outside clicks. No sidebar slot or resizeable sidebar (no 013 drawer uses one) and no
// "nudge" animation of a persistent drawer.
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed, inject, provide, ref, useTemplateRef } from 'vue';
import BoIcon from '../BoIcon.vue';

export type ApplyShortcut = 'meta+enter' | 'meta+s';

export interface Props {
	title: string;
	subtitle?: string | null;
	modelValue?: boolean | undefined;
	persistent?: boolean;
	icon?: string;
	/**
	 * Color of the icon displayed in the drawer header.
	 */
	iconColor?: string | undefined;
	cancelable?: boolean;
	applyShortcut?: ApplyShortcut;
}

const props = withDefaults(defineProps<Props>(), {
	subtitle: null,
	modelValue: undefined,
	iconColor: undefined,
	persistent: false,
	icon: 'box',
	cancelable: true,
	applyShortcut: 'meta+enter',
});

const emit = defineEmits(['cancel', 'apply', 'update:modelValue']);

const localActive = ref(false);

const scrollContainer = useTemplateRef<HTMLElement>('scroll-container');
provide('main-element', scrollContainer);

const depth = inject(BO_DRAWER_DEPTH, 0);
provide(BO_DRAWER_DEPTH, depth + 1);

const internalActive = computed({
	get() {
		return props.modelValue === undefined ? localActive.value : props.modelValue;
	},
	set(newActive: boolean) {
		localActive.value = newActive;
		emit('update:modelValue', newActive);
	},
});

// Backoffice: v-dialog emits `esc` and the drawer turns it into `cancel`; the parent closes the drawer (it may ask
// about unsaved changes first, FR-084).
function onEscape(event: KeyboardEvent) {
	event.preventDefault();
	if (props.cancelable) emit('cancel');
}

// v-dialog emitToggle: an overlay click closes unless persistent.
function onPointerDownOutside(event: Event) {
	if (props.persistent) event.preventDefault();
}

// v-dialog useShortcut(applyShortcut) (meta = Cmd on macOS, Ctrl elsewhere, as translateShortcut).
function onKeydown(event: KeyboardEvent) {
	const key = props.applyShortcut === 'meta+s' ? 's' : 'Enter';

	if ((event.metaKey || event.ctrlKey) && event.key === key) {
		event.preventDefault();
		emit('apply');
	}
}

// Recipe: focus goes to the first focusable element of the body, else to the panel itself.
function onOpenAutoFocus(event: Event) {
	event.preventDefault();

	const target = scrollContainer.value?.querySelector<HTMLElement>(
		'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
	);

	(target ?? (scrollContainer.value?.closest('[role="dialog"]') as HTMLElement | null))?.focus();
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<slot name="activator" v-bind="{ on: () => (internalActive = true) }" />

	<DialogRoot v-model:open="internalActive">
		<DialogPortal>
			<DialogOverlay
				class="bo-drawer-overlay fixed inset-0 z-99999"
				:class="depth > 0 ? 'bg-transparent' : 'bg-gray-900/50'"
			/>
			<DialogContent
				class="bo-drawer fixed inset-y-0 end-0 z-99999 flex w-full flex-col bg-white shadow-theme-xl outline-hidden xl:w-[640px] dark:bg-gray-900"
				:data-depth="depth"
				v-bind="subtitle ? {} : { 'aria-describedby': undefined }"
				@escape-key-down="onEscape"
				@pointer-down-outside="onPointerDownOutside"
				@open-auto-focus="onOpenAutoFocus"
				@keydown="onKeydown"
			>
				<header class="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
					<button
						v-if="cancelable"
						type="button"
						:aria-label="$t('cancel')"
						:title="`${$t('cancel')} (Esc)`"
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-white/[0.05] dark:text-gray-400 dark:hover:bg-white/[0.07] dark:hover:text-gray-300"
						:class="FOCUS"
						@click="$emit('cancel')"
					>
						<BoIcon name="close" />
					</button>

					<span
						v-if="icon"
						class="header-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
						:style="iconColor ? { color: iconColor } : undefined"
					>
						<BoIcon :name="icon" size="sm" />
					</span>

					<slot name="title-outer:prepend" />

					<div class="min-w-0 flex-1">
						<slot name="subtitle">
							<DialogDescription v-if="subtitle" class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
								{{ subtitle }}
							</DialogDescription>
						</slot>
						<slot name="title">
							<div class="flex min-w-0 items-center gap-2">
								<slot name="title:prepend" />
								<DialogTitle class="m-0 min-w-0 truncate text-lg font-semibold text-gray-800 dark:text-white/90">
									{{ title }}
								</DialogTitle>
								<slot name="header:append" />
							</div>
						</slot>
					</div>

					<div
						v-if="$slots['actions'] || $slots['actions:prepend'] || $slots['actions:append']"
						class="flex shrink-0 items-center gap-2"
					>
						<slot name="actions:prepend" />
						<slot name="actions" />
						<slot name="actions:append" />
					</div>
				</header>

				<main ref="scroll-container" class="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-6">
					<slot />
				</main>
			</DialogContent>
		</DialogPortal>
	</DialogRoot>
</template>

<style scoped>
/* Directus TransitionDialog (right placement): slide in from the end side; off under reduced motion. */
.bo-drawer[data-state='open'] {
	animation: bo-drawer-in 250ms ease-out;
}

.bo-drawer[data-state='closed'] {
	animation: bo-drawer-out 200ms ease-in;
}

.bo-drawer-overlay[data-state='open'] {
	animation: bo-drawer-fade-in 250ms ease-out;
}

.bo-drawer-overlay[data-state='closed'] {
	animation: bo-drawer-fade-out 200ms ease-in;
}

@keyframes bo-drawer-in {
	from {
		translate: var(--bo-drawer-offset, 100%) 0;
	}
}

@keyframes bo-drawer-out {
	to {
		translate: var(--bo-drawer-offset, 100%) 0;
	}
}

@keyframes bo-drawer-fade-in {
	from {
		opacity: 0;
	}
}

@keyframes bo-drawer-fade-out {
	to {
		opacity: 0;
	}
}

.bo-drawer:dir(rtl) {
	--bo-drawer-offset: -100%;
}

@media (prefers-reduced-motion: reduce) {
	.bo-drawer[data-state],
	.bo-drawer-overlay[data-state] {
		animation: none;
	}
}
</style>
