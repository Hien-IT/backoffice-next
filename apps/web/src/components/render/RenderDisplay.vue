<!-- Ported from directus/app/src/views/private/components/render-display.vue -->
<script setup lang="ts">
// Backoffice: the display comes from the registry (getDisplay) instead of a global component.
import { computed } from 'vue';
import { getDisplay } from '../../displays/index.ts';
import BoTextOverflow from '../BoTextOverflow.vue';
import ErrorBoundary from './ErrorBoundary.vue';
import ValueNull from './ValueNull.vue';

const props = defineProps<{
	display: string | null;
	options?: Record<string, unknown> | null | undefined;
	interface?: string | null | undefined;
	interfaceOptions?: Record<string, unknown> | null | undefined;
	value?: string | number | boolean | Record<string, unknown> | unknown[] | null | undefined;
	type: string;
	collection: string;
	field: string;
}>();

const displayInfo = computed(() => getDisplay(props.display) ?? null);
</script>

<template>
	<ValueNull v-if="value === null || value === undefined" />
	<BoTextOverflow v-else-if="displayInfo === null" class="leading-5" :text="value" />
	<ErrorBoundary v-else :name="`display-${display}`">
		<component
			:is="displayInfo.component"
			v-bind="options ?? {}"
			:interface="interface"
			:interface-options="interfaceOptions"
			:value="value"
			:type="type"
			:collection="collection"
			:field="field"
		/>

		<template #fallback>
			<BoTextOverflow class="leading-5" :text="value" />
		</template>
	</ErrorBoundary>
</template>
