<!-- Ported from directus/app/src/components/v-dialog.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7 #14, Q-44): v-dialog on a Reka Dialog (focus trap, scroll lock, aria-hidden
// siblings, Esc only on the top-most layer, focus return to the opener) instead of focus-trap and useShortcut. As
// DR the container covers the window: VOverlay behind, the slot (usually a VCard, which draws the panel) at the
// `placement` edge or centred. The dialog has no title of its own: its name is the text of the first heading (or card
// title) of the content, else "Dialog". Esc emits `esc` and closes; `persistent` keeps it open on Esc and on an overlay
// click and nudges the content instead. The apply shortcut emits `apply`; meta+s does nothing else while it is open.
// Deviations: teleported to `body` (a Reka modal marks an outlet that exists before it opens aria-hidden, so a dialog
// opened from a drawer would be hidden); `keepMounted` is accepted but the content unmounts when closed.
import { DialogContent, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { computed, ref, useTemplateRef } from 'vue';
import VOverlay from './VOverlay.vue';

export type ApplyShortcut = 'meta+enter' | 'meta+s';

interface Props {
	modelValue?: boolean | undefined;
	persistent?: boolean;
	placement?: 'left' | 'right' | 'center';
	/** Lets other overlays (drawer) open on top */
	keepBehind?: boolean;
	applyShortcut?: ApplyShortcut;
	/** Keeps child components mounted when closed on small screens */
	keepMounted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: undefined,
	persistent: false,
	placement: 'center',
	applyShortcut: 'meta+enter',
});

const emit = defineEmits(['esc', 'apply', 'update:modelValue']);

const localActive = ref(false);
const nudging = ref(false);
const label = ref('');
const body = useTemplateRef<HTMLElement>('body');

const internalActive = computed({
	get() {
		return props.modelValue !== undefined ? props.modelValue : localActive.value;
	},
	set(newActive: boolean) {
		localActive.value = newActive;
		emit('update:modelValue', newActive);
	},
});

function close() {
	if (props.persistent) nudge();
	else internalActive.value = false;
}

function nudge() {
	nudging.value = true;
	setTimeout(() => (nudging.value = false), 200);
}

function onEscape(event: KeyboardEvent) {
	event.preventDefault();
	emit('esc');
	close();
}

function onKeydown(event: KeyboardEvent) {
	if (!(event.metaKey || event.ctrlKey)) return;

	const key = event.key.toLowerCase();
	const apply = props.applyShortcut === 'meta+s' ? 's' : 'enter';

	if (key !== apply && key !== 's') return;

	event.preventDefault();
	event.stopPropagation();
	if (key === apply) emit('apply');
}

function onOpenAutoFocus() {
	const heading = body.value?.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"], .v-card-title');
	label.value = heading?.textContent?.trim() ?? '';
}
</script>

<template>
	<div class="v-dialog contents">
		<slot name="activator" v-bind="{ on: () => (internalActive = true) }" />

		<DialogRoot v-model:open="internalActive">
			<DialogPortal>
				<DialogContent
					class="v-dialog-container fixed inset-0 flex items-center outline-hidden"
					:class="[
						placement,
						keepBehind ? 'z-9999' : 'z-99999',
						{ center: 'justify-center', left: 'justify-start', right: 'justify-end' }[placement],
						{ nudge: nudging },
					]"
					:aria-describedby="undefined"
					@escape-key-down="onEscape"
					@interact-outside.prevent
					@open-auto-focus="onOpenAutoFocus"
					@keydown="onKeydown"
				>
					<DialogTitle class="sr-only">{{ label || $t('dialog') }}</DialogTitle>
					<VOverlay active absolute style="--v-overlay-z-index: 1" @click="close" />
					<!-- DR v-dialog.vue:204,241 card min width, :230-233 sheet hooks of the dialog content. -->
					<div
						ref="body"
						class="v-dialog-body relative z-2 flex *:shadow-theme-xl"
						:class="
							placement === 'center'
								? 'max-h-full max-w-full [&>.v-card]:[--v-card-min-width:calc(100vw-2.25rem)] sm:[&>.v-card]:[--v-card-min-width:30.375rem] [&>.v-sheet]:[--v-sheet-max-width:31.5rem] [&>.v-sheet]:[--v-sheet-padding:1.375rem]'
								: 'pointer-events-none h-full w-full *:pointer-events-auto'
						"
					>
						<slot />
					</div>
				</DialogContent>
			</DialogPortal>
		</DialogRoot>
	</div>
</template>

<style scoped>
/* DR TransitionDialog and the nudge of a persistent dialog; off under reduced motion. */
.v-dialog-container[data-state='open'] {
	animation: v-dialog-fade 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.v-dialog-container[data-state='closed'] {
	animation: v-dialog-fade 200ms cubic-bezier(0.4, 0, 0.2, 1) reverse;
}

.v-dialog-container[data-state='open'] > .v-dialog-body {
	animation: v-dialog-slide 200ms cubic-bezier(0, 0, 0.2, 1);
}

.v-dialog-container.center {
	--v-dialog-from: 0 2.8125rem;
}

.v-dialog-container.left {
	--v-dialog-from: -2.8125rem 0;
}

.v-dialog-container.right {
	--v-dialog-from: 2.8125rem 0;
}

.v-dialog-container.left:dir(rtl) {
	--v-dialog-from: 2.8125rem 0;
}

.v-dialog-container.right:dir(rtl) {
	--v-dialog-from: -2.8125rem 0;
}

.v-dialog-container.center.nudge > .v-dialog-body > :deep(*) {
	animation: v-dialog-nudge 200ms;
}

.v-dialog-container:is(.left, .right).nudge > .v-dialog-body > :deep(*) {
	animation: v-dialog-shake 200ms;
}

@keyframes v-dialog-fade {
	from {
		opacity: 0;
	}
}

@keyframes v-dialog-slide {
	from {
		translate: var(--v-dialog-from);
	}
}

@keyframes v-dialog-nudge {
	50% {
		scale: 1.02;
	}
}

@keyframes v-dialog-shake {
	50% {
		scale: 0.98 1;
	}
}

@media (prefers-reduced-motion: reduce) {
	.v-dialog-container[data-state],
	.v-dialog-container > .v-dialog-body,
	.v-dialog-container.nudge > .v-dialog-body > :deep(*) {
		animation: none;
	}
}
</style>
