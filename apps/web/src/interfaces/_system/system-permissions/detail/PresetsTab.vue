<!-- Ported from directus/app/src/interfaces/_system/system-permissions/detail/components/presets.vue -->
<script setup lang="ts">
// Backoffice: VNotice is BoNotice; useSync of @directus/composables is a computed with the same get/set.
import type { Permission, Policy } from '@directus/types';
import { computed } from 'vue';
import BoNotice from '../../../../components/BoNotice.vue';
import { useRelationsStore } from '../../../../stores/relations.ts';
import InterfaceInputCode from '../../../input-code/InputCode.vue';

const props = defineProps<{
	permission: Permission;
	policy?: Policy | undefined;
}>();

const emit = defineEmits<{ 'update:permission': [Permission] }>();

// @directus/composables useSync
const internalPermission = computed({
	get: () => props.permission,
	set: (value: Permission) => emit('update:permission', value),
});

const presets = computed({
	get() {
		return internalPermission.value.presets;
	},
	set(newPresets: Record<string, any> | null) {
		internalPermission.value = {
			...internalPermission.value,
			presets: newPresets,
		};
	},
});

const relationsStore = useRelationsStore();
const relations = relationsStore.getRelationsForCollection(props.permission.collection);
/**
 * Display a warning for all relational fields if an array is used as the preset value.
 * Interfaces in the app that use the useRelationMultiple composable expect the detailed syntax and not the array syntax.
 *
 * The useRelationMultiple composable treats arrays as an empty value and the preset would therefore not be shown in the app interface.
 * If the app interface is used, presets for relational fields have to be entered with the detailed syntax.
 * The api works correctly in both cases, so if the relational interface is not used in the app, the array syntax can be used as preset as well.
 */
// one_field is the field name that is used in the update syntax for a relational field
const relationFields = relations.map((relation) => relation.meta?.one_field).filter((field) => field);

const fieldWarnings = computed(() => {
	const warnings: string[] = [];

	if (!presets.value) {
		return warnings;
	}

	for (const key of Object.keys(presets.value)) {
		if (relationFields.includes(key) && Array.isArray(presets.value[key]) && presets.value[key].length > 0) {
			// Show the warning if the relational field uses a non-empty array as preset
			warnings.push(key);
		}
	}

	return warnings;
});
</script>

<template>
	<div class="flex flex-col gap-4">
		<BoNotice>
			{{
				$t('presets_for_policy', {
					action: $t(permission.action).toLowerCase(),
					policy: policy ? policy.name : $t('public_label'),
				})
			}}
		</BoNotice>
		<BoNotice v-for="field in fieldWarnings" :key="field" type="warning">
			{{
				$t('presets_field_warning', {
					field,
				})
			}}
		</BoNotice>
		<InterfaceInputCode :value="presets" language="json" type="json" @input="presets = $event" />
	</div>
</template>
