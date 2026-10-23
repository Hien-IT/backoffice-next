<!-- Ported from directus/app/src/panels/metric-list/panel-metric-list.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-042..FR-046, recipe Q-36): default color `cssVar('--color-brand-500')` (D-108) instead of
// `cssVar('--theme--primary')`; v-list/v-list-item become a `ul`/`li` list; look of the Q-36 recipe (label and value
// row in `text-theme-sm`, value `font-medium tabular-nums`, a `h-1.5` bar on a `bg-gray-100` track instead of the
// DR 1.125rem bar under labels as wide as the bar); no own padding (PanelTile pads the body). `inheritAttrs:
// false` (as the DR label panel) keeps the tile context props it does not declare out of the DOM. Logic as
// DR, quirks kept: `data` is sorted in place, the last matching conditional rule wins, `<=` compares with `<`.
import { isNil } from 'lodash-es';
import { computed, unref } from 'vue';
import { useI18n } from 'vue-i18n';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { cssVar } from '../../utils/css-var.ts';
import type { Notation, NumberFormatOptions, Style, Unit } from '../../utils/format-number.ts';
import { formatNumber } from '../../utils/format-number.ts';

defineOptions({ inheritAttrs: false });

// Backoffice: DR `Aggregate & { group: Group }`; a plain record for the dynamic keys (strict index access).
type DataPoint = Record<string, any>;

const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		groupByField?: string;
		aggregateField?: string;
		aggregateFunction?: string;
		sortDirection?: string;

		notation?: Notation;
		numberStyle?: Style;
		unit?: Unit | undefined;
		prefix?: string | null;
		suffix?: string | null;
		minimumFractionDigits?: number;
		maximumFractionDigits?: number;
		conditionalFormatting?: Record<string, any>[];
		collection: string;
		dashboard: string;
		data?: Array<DataPoint>;
	}>(),
	{
		showHeader: false,
		groupByField: '',
		aggregateField: '',
		aggregateFunction: '',
		sortDirection: 'desc',

		notation: 'standard',
		numberStyle: 'decimal',
		unit: undefined,
		prefix: '',
		suffix: '',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
		conditionalFormatting: () => [],
		data: () => [],
	},
);

const { locale } = useI18n();

const sortedData = computed(() => {
	const dataArray = unref(props.data);

	if (!dataArray || dataArray.length === 0) return [];

	if (!props.aggregateFunction || !props.aggregateField) return dataArray;

	return dataArray.sort((a: DataPoint, b: DataPoint) => {
		const aValue = a[props.aggregateFunction]?.[props.aggregateField] ?? 0;
		const bValue = b[props.aggregateFunction]?.[props.aggregateField] ?? 0;

		if (aValue === undefined || bValue === undefined) return 0;

		return props.sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
	});
});

function widthOfRow(row: any) {
	const aggFunc = props.aggregateFunction;
	const aggField = props.aggregateField;
	const data = props.data;
	return `${(row[aggFunc][aggField] / Math.max(...data.map((o) => o[aggFunc]?.[aggField] ?? 0))) * 100 + 0}%`;
}

function displayValue(value: number) {
	if (value === null || value === undefined) {
		return 0;
	}

	return formatNumber(Number(value), locale.value, {
		notation: props.notation,
		style: props.numberStyle,
		unit: props.unit,
		minimumFractionDigits: props.minimumFractionDigits,
		maximumFractionDigits: props.maximumFractionDigits,
		currency: props.numberStyle === 'currency' ? String(props.unit) : undefined,
	} as NumberFormatOptions);
}

function getColor(input?: number) {
	if (isNil(input)) return null;

	let matchingFormat = null;

	for (const format of props.conditionalFormatting || []) {
		if (matchesOperator(format)) {
			matchingFormat = format;
		}
	}

	return matchingFormat?.['color'] || cssVar('--color-brand-500');

	function matchesOperator(format: Record<string, any>) {
		if (typeof input === 'string') {
			const value = input;
			const compareValue = format['value'] ?? '';

			switch (format['operator'] || '>=') {
				case '=':
					return value === compareValue;
				case '!=':
					return value !== compareValue;
			}
		} else {
			const value = Number(input);
			const compareValue = Number(format['value'] ?? 0);

			switch (format['operator'] || '>=') {
				case '=':
					return value === compareValue;
				case '!=':
					return value !== compareValue;
				case '>':
					return value > compareValue;
				case '>=':
					return value >= compareValue;
				case '<':
					return value < compareValue;
				case '<=':
					// Backoffice (D-113, owner 2026-10-18): DR compares `<=` with `<` (R-53).
					return value <= compareValue;
			}
		}

		return false;
	}
}
</script>

<template>
	<!-- Backoffice (FR-106): the body scrolls when the rows overflow, so it takes the keyboard focus (axe
	     scrollable-region-focusable). -->
	<div
		class="size-full overflow-x-hidden overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		:class="{ 'has-header': showHeader }"
		tabindex="0"
	>
		<ul>
			<li
				v-for="row in sortedData"
				:key="row['group'][groupByField]"
				class="flex flex-col gap-1 border-b border-gray-100 py-1.5 last:border-b-0 dark:border-gray-800"
				data-metric-row
			>
				<div class="flex items-baseline justify-between gap-3 text-theme-sm text-gray-800 dark:text-white/90">
					<div class="min-w-0 truncate">
						<RenderTemplate
							:item="{ [groupByField]: row['group'][groupByField] }"
							:collection="collection"
							:template="`{{${groupByField}}}`"
						/>
					</div>

					<div
						class="shrink-0 font-medium whitespace-pre tabular-nums"
						:style="{
							color: getColor(row[aggregateFunction]?.[aggregateField]),
						}"
					>
						{{ prefix }}{{ displayValue(row[aggregateFunction]?.[aggregateField] ?? 0) }}{{ suffix }}
					</div>
				</div>

				<div class="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
					<div
						v-if="row[aggregateFunction]?.[aggregateField]"
						class="h-full rounded-full"
						data-metric-bar
						:style="{
							inlineSize: widthOfRow(row),
							'background-color': getColor(row[aggregateFunction]?.[aggregateField]),
						}"
					/>
				</div>
			</li>
		</ul>
	</div>
</template>
