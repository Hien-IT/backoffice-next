<!-- Ported from directus/app/src/views/private/private-view/components/private-view.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7, Q-45): the DR private view of extensions on the app shell of
// layout/PrivateView.vue (D-127/D-128). `showBack`/`backTo` → the back button (it replaces the icon, as in DR);
// `title` → `heading` (replaces the h1), `headline` → `headline-append`, `title-outer:append` → `title-append`; `sidebar` →
// the detail panel popover (SidebarDetail sections bring their own AccordionRoot). The page is a `fill` page, so the
// content scrolls inside it as in DR and that element is `main-element`. `sidebarShadow` and `showHeaderShadow`
// are not used: the shell has no scroll shadows. The layout has several roots (the notifications drawer), so `class`
// goes on a wrapper.
import { computed, provide, useTemplateRef } from 'vue';
import LayoutPrivateView from '../../layout/PrivateView.vue';

const props = defineProps<{
	title?: string;
	icon?: string;
	iconColor?: string;
	showBack?: boolean;
	backTo?: string;
	sidebarShadow?: boolean;
	showHeaderShadow?: boolean;
}>();

defineOptions({ inheritAttrs: false });

const view = useTemplateRef<InstanceType<typeof LayoutPrivateView>>('view');
provide(
	'main-element',
	computed(() => view.value?.scrollElement ?? undefined),
);

const back = computed(() => (props.showBack ? (props.backTo ?? true) : undefined));
</script>

<template>
	<div :class="$attrs.class">
		<LayoutPrivateView
			ref="view"
			fill
			:title="title"
			:icon="showBack ? undefined : icon"
			:icon-color="iconColor"
			:back="back"
		>
			<template v-if="$slots['navigation']" #navigation><slot name="navigation" /></template>
			<template v-if="$slots['headline']" #headline-append><slot name="headline" /></template>
			<template v-if="$slots['title-outer:prepend']" #title-outer:prepend><slot name="title-outer:prepend" /></template>
			<template v-if="$slots['title']" #heading><slot name="title" /></template>
			<template v-if="$slots['title:prepend']" #title:prepend><slot name="title:prepend" /></template>
			<template v-if="$slots['title:append']" #title:append><slot name="title:append" /></template>
			<template v-if="$slots['title-outer:append']" #title-append><slot name="title-outer:append" /></template>
			<template v-if="$slots['actions:prepend']" #actions:prepend><slot name="actions:prepend" /></template>
			<template v-if="$slots['actions']" #actions><slot name="actions" /></template>
			<template v-if="$slots['actions:append']" #actions:append><slot name="actions:append" /></template>
			<template v-if="$slots['sidebar']" #sidebar><slot name="sidebar" /></template>

			<!-- DR private-view-main.vue:216-221,242-245: the content sits in block flow in a full-height box, so the
				 scroller above stays the one scrolling element and extension roots do not shrink as flex items. -->
			<div class="h-full shrink-0"><slot /></div>
		</LayoutPrivateView>
	</div>
</template>
