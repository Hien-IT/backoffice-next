<!-- Ported from directus/app/src/panels/meter/panel-meter.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-042..FR-046, recipe Q-36): default color `var(--color-brand-500)` (D-108) instead of
// `var(--theme--primary)`; the track is `stroke-gray-100 dark:stroke-gray-800` instead of
// `var(--theme--background-subdued)`; the scoped `v-bind()` CSS (font size, dash array/offset, rotation, half-size
// offset) is inline style; the SVG is aria-hidden (the output carries the value); no own padding (PanelTile pads the
// body). `inheritAttrs: false` (as the DR label panel) keeps the tile context props it does not declare out of
// the DOM. Logic as DR, quirks kept: the first matching rule wins (`find`), `<=` compares with `<`, the radius
// counts 20 px per grid cell (DR grid size).
import { computed, unref } from 'vue';
import { useI18n } from 'vue-i18n';

defineOptions({ inheritAttrs: false });

// directus/app/src/types/panels.ts
type PanelFunction = 'count' | 'countDistinct' | 'avg' | 'avgDistinct' | 'sum' | 'sumDistinct' | 'min' | 'max';
type BaseConditionalFillOperators = '=' | '!=' | '>' | '>=' | '<' | '<=';

type ConditionalFillFormat = {
	operator: BaseConditionalFillOperators;
	color: string;
	value: number;
};

interface Props {
	showHeader: boolean;
	collection: string;
	field: string;
	width: number;
	height: number;
	fn: PanelFunction;
	data?: { [fn: string]: { [field: string]: number } }[];
	size?: 'full' | 'half';
	decimals?: number;
	strokeWidth?: number;
	roundedStroke?: boolean;
	showPercentage?: boolean;
	color?: string | null;
	max?: number;
	conditionalFill?: ConditionalFillFormat[] | null;
}

const props = withDefaults(defineProps<Props>(), {
	decimals: 0,
	data: () => [],
	strokeWidth: 20,
	roundedStroke: false,
	showPercentage: true,
	color: 'var(--color-brand-500)',
	max: 100,
	conditionalFill: () => [],
	size: 'full',
});

const { n } = useI18n();

const percent = computed(() => {
	if (props.data.length === 0) return 0;
	if (!props.fn || !props.field) return 0;
	return Number(props.data[0]![props.fn]![props.field]) / Number(props.max);
});

const displayValue = computed(() => {
	const percentDecimal = Number((unref(percent) * 100).toFixed(1));
	return props.showPercentage ? n(percentDecimal) + '%' : '';
});

const radius = computed(() => {
	// 24 is 12*2 padding, 4 is 2*2 border
	const widthPx = props.width * 20 - 24 - 4;
	let heightPx = props.height * 20 - 24 - 4;

	// Adjust for header if enabled, v-workspace-tile header has a fixed height of 2.375rem
	if (props.showHeader) heightPx = heightPx - 42;

	const strokeOffset = props.strokeWidth / 2;

	// Determine the shorter dimension
	const minDimension = Math.min(widthPx, heightPx);

	if (props.size == 'half' && heightPx < widthPx) {
		// Added so half circles that have a shorter height than width can maximize the space up to the padding of the height
		return Math.min(widthPx / 2 - strokeOffset, (props.height * 30) / 2 - 12);
	}

	// The radius is half of the shorter dimension inclusive of padding and border
	return minDimension / 2 - strokeOffset;
});

const svgSize = computed(() => {
	const width = unref(radius) * 2 + props.strokeWidth;

	if (props.size === 'half') {
		return {
			width,
			height: unref(radius) + props.strokeWidth,
		};
	}

	return {
		width,
		height: unref(radius) * 2 + props.strokeWidth,
	};
});

const circumference = computed(() => {
	return unref(radius) * 2 * Math.PI;
});

const dashOffset = computed(() => {
	const full = unref(circumference) - unref(percent) * unref(circumference);
	if (props.size === 'half') return full / 2;
	return full;
});

const conditionalColor = computed(() => {
	const defaultColor = props.color ?? 'var(--color-brand-500)';

	if (!unref(percent) || !props.conditionalFill?.length) {
		return defaultColor;
	}

	return (
		props.conditionalFill.find((format) => {
			const percentValue = unref(percent) * 100;
			const compareValue = +(format.value ?? 0);

			switch (format.operator || '>=') {
				case '=':
					return percentValue === compareValue;
				case '!=':
					return percentValue !== compareValue;
				case '>':
					return percentValue > compareValue;
				case '>=':
					return percentValue >= compareValue;
				case '<':
					return percentValue < compareValue;
				case '<=':
					// Backoffice (D-113, owner 2026-10-18): DR compares `<=` with `<` (R-53).
					return percentValue <= compareValue;
			}
		})?.color ?? defaultColor
	);
});

const fontSize = computed(() => Math.min(Math.ceil(unref(circumference) / 100) * 7, 48) + 'px');

const halfSizeOutputOffset = computed(() => unref(radius) / 4 + props.strokeWidth / 2 + 'px');
</script>

<template>
	<div
		class="relative grid size-full place-items-center justify-center *:col-start-1 *:row-start-1"
		:class="[{ 'has-header': showHeader }, `size-${size}`]"
	>
		<output
			class="z-1 leading-[2.9375rem] font-extrabold text-gray-800 dark:text-white/90"
			:class="{ relative: size === 'half' }"
			:style="{ fontSize, insetBlockStart: size === 'half' ? halfSizeOutputOffset : undefined }"
		>
			{{ displayValue }}
		</output>
		<svg :width="svgSize.width" :height="svgSize.height" aria-hidden="true">
			<circle
				cx="50%"
				:cy="size === 'half' ? '100%' : '50%'"
				fill="none"
				:stroke-width="strokeWidth"
				:stroke-linecap="roundedStroke ? 'round' : 'inherit'"
				:r="radius"
				class="stroke-gray-100 dark:stroke-gray-800"
			/>
			<circle
				cx="50%"
				:cy="size === 'half' ? '100%' : '50%'"
				fill="none"
				:stroke-width="strokeWidth"
				:stroke-linecap="roundedStroke ? 'round' : 'inherit'"
				:r="radius"
				:stroke="conditionalColor"
				data-meter-value
				:style="{
					transformOrigin: size === 'half' ? 'bottom' : 'center center',
					transform: size === 'half' ? 'rotate(0deg)' : 'rotate(-90deg)',
					strokeDasharray: `${circumference} ${circumference}`,
					strokeDashoffset: dashOffset,
				}"
			/>
		</svg>
	</div>
</template>
