<!-- Ported from directus/app/src/panels/label/panel-label.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-042..FR-046, recipe Q-36): styles as Tailwind classes (text `text-gray-800
// dark:text-white/90` instead of `var(--color-text)`, fonts `font-outfit`, `font-[serif]`, `font-[monospace]` as
// DisplayFormattedValue: the theme has no `font-serif`/`font-mono`); the user color stays inline. Logic as Directus:
// the text is plain interpolation (no HTML), `inheritAttrs: false` keeps the tile context out of the DOM.
import { type CSSProperties, onBeforeUnmount, onMounted, onUpdated, type Ref, ref } from 'vue';
import { useAutoFontFit } from '../../composables/use-auto-fit-text.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		text?: string;
		whiteSpace?: CSSProperties['white-space'];
		color?: string | undefined;
		textAlign?: CSSProperties['text-align'];
		fontSize?: 'sm' | 'md' | 'lg' | 'auto';
		fontWeight?: number | undefined;
		fontStyle?: string | undefined;
		font?: 'sans-serif' | 'serif' | 'monospace';
	}>(),
	{
		text: '',
		color: undefined,
		whiteSpace: 'normal',
		textAlign: 'center',
		fontSize: 'auto',
		fontWeight: 800,
		fontStyle: undefined,
		font: 'sans-serif',
	},
);

const FONTS = { 'sans-serif': 'font-outfit', serif: 'font-[serif]', monospace: 'font-[monospace]' };

const labelContainer: Ref<HTMLDivElement | null> = ref(null);
const labelText: Ref<HTMLParagraphElement | null> = ref(null);

const { adjustFontSize } = useAutoFontFit(labelContainer, labelText);

let resizeObserver: ResizeObserver | null = null;

function adjustPadding() {
	const container = labelContainer.value;
	if (!container) return;

	const paddingWidth = container.offsetWidth * 0.05;
	const paddingHeight = container.offsetHeight * 0.05;

	const padding = Math.round(Math.max(12, Math.min(paddingWidth, paddingHeight)));

	if (props.showHeader == true) {
		container.style.padding = '0 0.6875rem 0.6875rem 0.6875rem';
	} else {
		container.style.padding = `${padding}px`;
	}

	return;
}

function unmountResizeObserver() {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
}

async function updateFit() {
	if (props.fontSize !== 'auto' || props.text.length <= 0) {
		unmountResizeObserver();
		return;
	}

	await document.fonts.ready;
	adjustPadding();
	adjustFontSize();

	if (!resizeObserver) {
		const container = labelContainer.value;
		if (!container) return;

		// Create a ResizeObserver to watch for changes in the container's dimensions
		resizeObserver = new ResizeObserver(() => {
			updateFit();
		});

		resizeObserver.observe(container);
	}

	adjustFontSize();
}

onMounted(() => {
	updateFit();
});

onUpdated(() => {
	updateFit();
});

onBeforeUnmount(() => {
	unmountResizeObserver();
});
</script>

<template>
	<div
		ref="labelContainer"
		class="flex size-full items-center text-2xl leading-[1.2] font-medium text-gray-800 dark:text-white/90"
		:class="[FONTS[font], { 'has-header': showHeader }]"
		:style="{ color: color }"
	>
		<p
			ref="labelText"
			class="min-h-min w-full min-w-min"
			:style="{ whiteSpace, fontWeight, textAlign, fontStyle, fontSize: fontSize !== 'auto' ? fontSize : undefined }"
		>
			{{ text }}
		</p>
	</div>
</template>
