<!-- Ported from directus/app/src/components/v-text-overflow.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): a port rather than BoTextOverflow, whose cut text shows as a native `title`:
// here it is the shim `v-tooltip` at `placement`, as Directus; `highlight` renders the globally registered VHighlight
// shim (resolved by name, as the other shims are registered with it).
import { useElementSize } from '@vueuse/core';
import { ref, watch } from 'vue';
import vTooltip from '../directives/tooltip.ts';

interface Props {
	/** The text that should be displayed */
	text?: string | number | boolean | Record<string, any> | Array<any> | undefined;
	/** What parts of the text should be highlighted */
	highlight?: string | undefined;
	/** The placement of the tooltip */
	placement?: 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';
}

withDefaults(defineProps<Props>(), {
	text: undefined,
	highlight: undefined,
	// ponytail: a factory, because contract.test.ts evaluates a plain string default as code ('top' is window.top).
	placement: () => 'top',
});

const el = ref<HTMLElement>();
const hasEllipsis = ref(false);

const { width } = useElementSize(el);

watch(
	width,
	() => {
		if (!el.value) return;
		hasEllipsis.value = el.value.offsetWidth < el.value.scrollWidth;
	},
	{ immediate: true },
);
</script>

<template>
	<div ref="el" v-tooltip:[placement]="hasEllipsis && text" class="v-text-overflow truncate">
		<!-- Resolved by name only when highlighting: VHighlight is another shim, registered globally. -->
		<component :is="'VHighlight'" v-if="highlight" :query="highlight" :text="text" />
		<template v-else>{{ text }}</template>
	</div>
</template>
