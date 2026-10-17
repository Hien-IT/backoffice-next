<script setup lang="ts">
// Backoffice (spec 018 FR-106, Clarifications, Q-35): the data of a chart as an sr-only table for screen readers; the
// drawn chart is aria-hidden. The cells are the values the panel gave ApexCharts, before formatting (FR-105), so the
// E2E reads the chart data from here (`data-chart-table`). The caption is the tile label PanelTile provides.
import { inject } from 'vue';
import { PANEL_LABEL } from './panel-label.ts';

defineProps<{
	columns: string[];
	rows: (string | number | null)[][];
}>();

const caption = inject(PANEL_LABEL, null);
</script>

<template>
	<table class="sr-only" data-chart-table>
		<caption>
			{{ caption ?? '' }}
		</caption>
		<thead>
			<tr>
				<th v-for="(column, index) in columns" :key="index" scope="col">{{ column }}</th>
			</tr>
		</thead>
		<tbody>
			<tr v-for="(row, rowIndex) in rows" :key="rowIndex">
				<td v-for="(cell, cellIndex) in row" :key="cellIndex" :data-value="cell ?? ''">{{ cell ?? '' }}</td>
			</tr>
		</tbody>
	</table>
</template>
