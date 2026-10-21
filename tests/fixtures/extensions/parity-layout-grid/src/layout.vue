<template>
	<div class="parity-layout-grid" data-testid="parity-grid">
		<v-table :headers="headers" :items="items" :loading="loading" item-key="id" inline :show-select="'none'" />
		<v-pagination v-if="totalPages > 1" v-model="pageModel" :length="totalPages" :total-visible="5" />
	</div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
	items: { type: Array, default: () => [] },
	loading: { type: Boolean, default: false },
	page: { type: Number, default: 1 },
	totalPages: { type: Number, default: 1 },
});

const emit = defineEmits(['update:page']);

const headers = computed(() => {
	const first = props.items[0] ?? { id: null };
	return Object.keys(first).map((key) => ({ text: key, value: key }));
});

const pageModel = computed({
	get: () => props.page,
	set: (value) => emit('update:page', value),
});
</script>
