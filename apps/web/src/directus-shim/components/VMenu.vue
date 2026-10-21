<!-- Ported from directus/app/src/components/v-menu.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #38, Q-44): v-menu on BoPopover (Reka Popover, floating-ui) instead of Popper and
// focus-trap. The popper `placement` maps to side/align, `offsetY`/`offsetX` to the side/align offsets; `attached`
// draws the menu under the activator at its width. As Directus the activator slot opens the menu itself (toggle,
// `trigger` click or hover) and the focus stays where it is on open; Tab from the activator moves into the menu. Esc
// and an outside click close it (not a click on the activator, nor any click with `closeOnClick` false) and the focus
// returns to the element focused before opening (unless `noFocusReturn`). Teleported to `body` instead of
// #menu-outlet (BoPopover). Not honoured: `arrowPlacement` (the arrow points at the middle of the activator) and
// `trigger: 'keyDown'` (no handler in Directus either).
import { debounce } from 'lodash-es';
import { nanoid } from 'nanoid/non-secure';
import { computed, ref, useTemplateRef, watch } from 'vue';
import BoPopover from '../../components/BoPopover.vue';

interface Props {
	/** Where to position the popper */
	placement?: string;
	/** Model the open state */
	modelValue?: boolean | undefined;
	/** Close the menu when clicking outside of the menu */
	closeOnClick?: boolean;
	/** Close the menu when clicking the content of the menu */
	closeOnContentClick?: boolean;
	/** Attach the menu to an input */
	attached?: boolean;
	/** Show an arrow pointer */
	showArrow?: boolean;
	/** Fixed arrow placement */
	arrowPlacement?: 'start' | undefined;
	/** Space between the arrow and the edge of the menu */
	arrowPadding?: number;
	/** Menu does not appear */
	disabled?: boolean;
	/** Activate the menu on a trigger */
	trigger?: 'hover' | 'click' | 'keyDown' | null;
	/** Time in ms before menu activates after trigger */
	delay?: number;
	/** Offset from the top */
	offsetY?: number;
	/** Offset from the left */
	offsetX?: number;
	/** Removes the scrollbar */
	fullHeight?: boolean;
	/** Removes any styling from the menu */
	seamless?: boolean;
	/** Lets other overlays (drawer, dialog) open on top */
	keepBehind?: boolean;
	/** Do not focus activator when deactivating focus trap */
	noFocusReturn?: boolean;
	/** Invert the menu colors */
	invert?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	placement: 'bottom',
	modelValue: undefined,
	closeOnClick: true,
	closeOnContentClick: true,
	arrowPlacement: undefined,
	arrowPadding: 6,
	trigger: null,
	delay: 0,
	offsetY: 8,
	offsetX: 0,
	invert: false,
});

const emit = defineEmits(['update:modelValue']);

const TABBABLE =
	'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const activator = ref<HTMLElement | null>(null);
const menuEl = useTemplateRef<HTMLElement>('menuEl');
const id = nanoid();

const zeroRect = (x = 0, y = 0) => ({ getBoundingClientRect: () => new DOMRect(x, y, 0, 0) });
const virtualReference = ref(zeroRect());

const localIsActive = ref(false);

const isActive = computed<boolean>({
	get() {
		return props.modelValue !== undefined ? props.modelValue : localIsActive.value;
	},
	set(newActive) {
		localIsActive.value = newActive;
		emit('update:modelValue', newActive);
	},
});

// Directus: the first element of the activator slot, else the point of the event given to activate().
const reference = computed(() => {
	void isActive.value;
	return (activator.value?.children[0] as HTMLElement | undefined) ?? virtualReference.value;
});

// Popper placement (`bottom-start`, `auto`...) → side and align.
const position = computed(() => {
	if (props.attached) return { side: 'bottom', align: 'start', sideOffset: 0, alignOffset: 0 } as const;

	const [side, align] = props.placement.split('-') as [string, string | undefined];

	return {
		side: (['top', 'right', 'bottom', 'left'].includes(side) ? side : 'bottom') as 'top' | 'right' | 'bottom' | 'left',
		align: (align === 'start' || align === 'end' ? align : 'center') as 'start' | 'center' | 'end',
		sideOffset: props.offsetY,
		alignOffset: props.offsetX,
	};
});

defineExpose({ activator, id, activate, deactivate });

function activate(event?: MouseEvent) {
	if (event) virtualReference.value = zeroRect(event.clientX, event.clientY);
	isActive.value = true;
}

function deactivate() {
	isActive.value = false;
}

function toggle() {
	if (props.disabled === true) return;
	isActive.value = !isActive.value;
}

const slotProps = computed(() => ({ toggle, active: isActive.value, activate, deactivate }));

// The focus returns to the element focused before opening when the menu took it (closed from inside or by Esc).
let returnFocus: HTMLElement | null = null;

watch(
	isActive,
	(active) => {
		if (active) returnFocus = document.activeElement as HTMLElement | null;
	},
	{ flush: 'sync', immediate: true },
);

function onCloseAutoFocus(event: Event) {
	event.preventDefault();
	// Reka dispatches this before the panel leaves the DOM: the focus is lost when it is still inside.
	const current = document.activeElement;
	const lost = !current || current === document.body || (event.target as Node | null)?.contains(current);

	if (!props.noFocusReturn && returnFocus?.isConnected && lost) returnFocus.focus();
	returnFocus = null;
}

function onInteractOutside(event: Event) {
	if (!props.closeOnClick || activator.value?.contains(event.target as Node)) event.preventDefault();
}

function onActivatorKeydown(event: KeyboardEvent) {
	if (event.key !== 'Tab' || event.shiftKey || !isActive.value || !menuEl.value) return;
	event.preventDefault();
	(menuEl.value.querySelector<HTMLElement>(TABBABLE) ?? menuEl.value).focus();
}

function onContentClick(event: Event) {
	event.stopPropagation();
	if (event.target !== event.currentTarget) deactivate();
}

const isHovered = ref(false);

watch(
	isHovered,
	debounce((hovered: boolean) => {
		if (hovered) {
			if (!isActive.value) activate();
		} else {
			deactivate();
		}
	}, props.delay),
);

function onPointerEnter(event: Event) {
	event.stopPropagation();
	isHovered.value = true;
}

function onPointerLeave(event: Event) {
	event.stopPropagation();
	isHovered.value = false;
}

const hoverListeners = computed(() =>
	props.trigger === 'hover' ? { pointerenter: onPointerEnter, pointerleave: onPointerLeave } : {},
);
</script>

<template>
	<div class="v-menu contents" v-on="trigger === 'click' ? { click: toggle } : {}">
		<div
			ref="activator"
			class="v-menu-activator contents"
			:class="{ attached }"
			v-on="hoverListeners"
			@keydown="onActivatorKeydown"
		>
			<slot name="activator" v-bind="slotProps" />
		</div>

		<BoPopover
			v-model:open="isActive"
			:reference="reference"
			:side="position.side"
			:align="position.align"
			:side-offset="position.sideOffset"
			:align-offset="position.alignOffset"
			:arrow="showArrow"
			:arrow-padding="arrowPadding"
			seamless
			class="v-menu-popper min-w-22.5"
			:class="{ 'min-w-(--reka-popper-anchor-width)': attached, 'z-9999!': keepBehind }"
			@interact-outside="onInteractOutside"
			@open-auto-focus.prevent
			@close-auto-focus="onCloseAutoFocus"
		>
			<div
				:id="id"
				ref="menuEl"
				tabindex="-1"
				class="v-menu-content overflow-y-auto rounded-[inherit] outline-hidden"
				:class="[
					seamless ? 'p-0' : 'p-2',
					fullHeight ? '' : 'max-h-[30vh]',
					invert ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : '',
				]"
				v-on="{ ...(closeOnContentClick ? { click: onContentClick } : {}), ...hoverListeners }"
			>
				<slot v-bind="slotProps" />
			</div>
		</BoPopover>
	</div>
</template>
