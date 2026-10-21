<template>
	<div class="parity-interface-color">
		<v-input
			:model-value="value"
			:placeholder="placeholder"
			:disabled="disabled"
			data-testid="parity-color-input"
			@update:model-value="$emit('input', $event)"
		>
			<template #append>
				<v-menu show-arrow placement="bottom-end">
					<template #activator="{ toggle }">
						<v-icon v-tooltip="'Presets'" name="palette" clickable data-testid="parity-color-menu" @click="toggle" />
					</template>
					<v-list>
						<v-list-item v-for="color in presets" :key="color" clickable @click="$emit('input', color)">
							<v-list-item-content>{{ color }}</v-list-item-content>
						</v-list-item>
					</v-list>
				</v-menu>
			</template>
		</v-input>
		<v-select
			:model-value="value"
			:items="items"
			:disabled="disabled"
			placeholder="Pick"
			data-testid="parity-color-select"
			@update:model-value="$emit('input', $event)"
		/>
		<p class="type-note" data-testid="parity-color-info">{{ info }}</p>
	</div>
</template>

<script setup>
import { useApi, useStores } from '@directus/extensions-sdk';
import { computed, onMounted, ref } from 'vue';

defineProps({
	value: { type: String, default: null },
	disabled: { type: Boolean, default: false },
	placeholder: { type: String, default: null },
});

defineEmits(['input']);

const presets = ['red', 'green', 'blue'];
const items = computed(() => presets.map((color) => ({ text: color.toUpperCase(), value: color })));

const api = useApi();
const { useUserStore } = useStores();
const userStore = useUserStore();
const info = ref('');

onMounted(async () => {
	const response = await api.get('/server/ping');
	info.value = `${userStore.currentUser?.email ?? 'anonymous'}: ${response.data}`;
});
</script>

<style scoped>
/* The input, the select and the note stacked with the spacing of a Directus form (the components have no margin). */
.parity-interface-color {
	display: grid;
	gap: 8px;
}
</style>
