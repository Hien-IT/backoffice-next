<!-- Ported from directus/app/src/displays/formatted-json-value/formatted-json-value.vue -->
<script setup lang="ts">
import { render } from 'micromustache';
import { computed } from 'vue';
import ItemsMenu from '../../components/render/ItemsMenu.vue';
import ValueNull from '../../components/render/ValueNull.vue';

const props = withDefaults(
	defineProps<{
		value?: Record<string, any> | Record<string, any>[] | null;
		format?: string | null;
	}>(),
	{
		value: null,
		format: null,
	},
);

const displayValue = computed(() => {
	if (!props.value) return null;

	try {
		if (Array.isArray(props.value)) {
			return props.value.map((item: any) => renderValue(item));
		} else {
			return [renderValue(props.value)];
		}
	} catch {
		return null;
	}
});

function renderValue(input: Record<string, any> | Record<string, any>[]) {
	if (props.format) {
		return render(props.format, input);
	} else {
		return render('{{ value }}', { value: input });
	}
}
</script>

<template>
	<ValueNull v-if="!displayValue" />
	<!-- Backoffice: "N items" menu recipe (ItemsMenu) instead of v-menu. -->
	<ItemsMenu v-else-if="displayValue.length > 1">
		<template #trigger>
			<span class="label">
				{{ displayValue.length }}
				{{ $t('items') }}
			</span>
		</template>

		<ul class="links space-y-1">
			<li
				v-for="(item, index) in displayValue"
				:key="index"
				class="px-3 py-2 text-theme-sm text-gray-700 dark:text-gray-400"
			>
				{{ item }}
			</li>
		</ul>
	</ItemsMenu>
	<span v-else>
		{{ displayValue[0] }}
	</span>
</template>
