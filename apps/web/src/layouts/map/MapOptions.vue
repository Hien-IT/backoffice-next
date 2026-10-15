<!-- Ported from directus/app/src/layouts/map/options.vue -->
<script setup lang="ts">
// Backoffice: BoSelect, BoInput and BoCheckbox with their labels instead of `.type-label` + v-select/v-checkbox; the
// display template is a text input (the app has no v-collection-field-template yet), same `{{ field }}` syntax and
// placeholder; the disabled "no compatible fields" input is a Card empty block (recipe Q-6). The basemap stays in
// the app store like Directus (FR-039).
import type { GeometryOptions, Item } from '@directus/types';
import { storeToRefs } from 'pinia';
import BoCheckbox from '../../components/BoCheckbox.vue';
import BoInput from '../../components/BoInput.vue';
import BoSelect from '../../components/BoSelect.vue';
import { useAppStore } from '../../stores/app.ts';
import { getBasemapSources } from '../../utils/geometry/basemap.ts';

defineOptions({ inheritAttrs: false });

defineProps<{
	collection: string;
	geometryFields: Item[];
	geometryField?: string | undefined;
	geometryOptions?: GeometryOptions | undefined;
	clusterData?: boolean | undefined;
	displayTemplate?: string | undefined;
}>();

const emit = defineEmits<{
	(e: 'update:geometryField', geometryField: string): void;
	(e: 'update:clusterData', clusterData: boolean): void;
	(e: 'update:displayTemplate', displayTemplate: string): void;
}>();

const basemaps = getBasemapSources();
const { basemap } = storeToRefs(useAppStore());
</script>

<template>
	<div class="flex flex-col gap-5">
		<BoSelect
			v-model="basemap"
			:label="$t('layouts.map.basemap')"
			:items="basemaps.map((s) => ({ text: s.name, value: s.name }))"
		/>

		<p
			v-if="geometryFields.length == 0"
			class="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-theme-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
			data-empty="geometry"
		>
			{{ $t('layouts.map.no_compatible_fields') }}
		</p>
		<BoSelect
			v-else
			:label="$t('layouts.map.field')"
			:model-value="geometryField ?? null"
			:items="geometryFields.map(({ name, field }) => ({ text: name, value: field }))"
			@update:model-value="emit('update:geometryField', $event as string)"
		/>

		<BoInput
			:label="$t('display_template')"
			:model-value="displayTemplate ?? ''"
			:placeholder="$t('layouts.map.default_template')"
			@update:model-value="emit('update:displayTemplate', $event)"
		/>

		<BoCheckbox
			:model-value="clusterData ?? false"
			:label="$t('layouts.map.cluster')"
			:disabled="geometryOptions && geometryOptions.geometryType !== 'Point'"
			@update:model-value="emit('update:clusterData', $event)"
		/>
	</div>
</template>
