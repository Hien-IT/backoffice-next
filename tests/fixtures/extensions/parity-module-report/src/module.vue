<template>
	<private-view title="Parity Report" icon="summarize">
		<template #headline>
			<v-breadcrumb :items="[{ name: 'Report', to: '/parity-module-report' }]" />
		</template>
		<template #navigation>
			<v-list nav>
				<v-list-item
					v-for="section in sections"
					:key="section"
					clickable
					:active="active === section"
					@click="active = section"
				>
					<v-list-item-content>{{ section }}</v-list-item-content>
				</v-list-item>
			</v-list>
		</template>
		<template #actions>
			<v-button v-tooltip.bottom="'Open dialog'" rounded icon data-testid="parity-report-open" @click="dialog = true">
				<v-icon name="info" />
			</v-button>
		</template>
		<template #sidebar>
			<sidebar-detail id="parity-report-info" icon="info" title="Information">
				<div class="type-note">Parity report sidebar</div>
			</sidebar-detail>
		</template>

		<div class="parity-module-report" data-testid="parity-report">
			<h2 class="type-title">Section {{ active }}</h2>
			<v-notice type="info">The report module is a parity fixture.</v-notice>
		</div>

		<v-dialog v-model="dialog" @esc="dialog = false">
			<v-card>
				<v-card-title>Parity dialog</v-card-title>
				<v-card-text>Dialog content</v-card-text>
				<v-card-actions>
					<v-button data-testid="parity-report-close" @click="dialog = false">Close</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</private-view>
</template>

<script setup>
import { ref } from 'vue';

const sections = ['A', 'B'];
const active = ref('A');
const dialog = ref(false);
</script>
