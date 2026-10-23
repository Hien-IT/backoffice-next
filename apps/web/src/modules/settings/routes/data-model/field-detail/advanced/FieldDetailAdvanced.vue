<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced.vue; Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-tabs.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-22): the tab list (field-detail-advanced-tabs.vue, same tabs by local type) and the tab content
// in one BoTabs: vertical from 1024px, horizontal above the content below. Directus puts the tabs in the drawer
// sidebar; here they stay in the drawer body next to the content.
import { useMediaQuery } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoTabs from '../../../../../../components/BoTabs.vue';
import { useFieldDetailStore } from '../store/index.ts';
import AdvancedConditions from './AdvancedConditions.vue';
import AdvancedDisplay from './AdvancedDisplay.vue';
import AdvancedField from './AdvancedField.vue';
import AdvancedInterface from './AdvancedInterface.vue';
import AdvancedRelationship from './AdvancedRelationship.vue';
import AdvancedSchema from './AdvancedSchema.vue';
import AdvancedValidation from './AdvancedValidation.vue';

const currentTab = defineModel<string>('currentTab', { default: 'schema' });

const fieldDetail = useFieldDetailStore();

const { localType } = storeToRefs(fieldDetail);

const { t } = useI18n();

const wide = useMediaQuery('(min-width: 1024px)');

const tabs = computed(() => {
	const tabs = [
		{
			label: t('schema'),
			value: 'schema',
		},
		{
			label: t('field', 1),
			value: 'field',
		},
		{
			label: t('interface_label'),
			value: 'interface',
		},
	];

	if (localType.value !== 'presentation' && localType.value !== 'group') {
		tabs.push({
			label: t('display'),
			value: 'display',
		});
	}

	if (['o2m', 'm2o', 'm2m', 'm2a', 'files', 'file'].includes(localType.value)) {
		tabs.splice(1, 0, {
			label: t('relationship'),
			value: 'relationship',
		});
	}

	if (localType.value === 'translations') {
		tabs.splice(1, 0, {
			label: t('translations'),
			value: 'relationship',
		});
	}

	tabs.push({
		label: t('validation'),
		value: 'validation',
	});

	tabs.push({
		label: t('conditions'),
		value: 'conditions',
	});

	return tabs;
});
</script>

<template>
	<!-- Owner 2026-10-23 (D-167): like the Directus drawer, the tab content sits on the project color tint of the page
	     (scrolling on its own) and the tab list on white; below 1024px the tabs are above the content as before. -->
	<div class="flex min-h-0 flex-1 flex-col" :class="{ 'custom-scrollbar overflow-y-auto p-6': !wide }">
		<BoTabs
			v-model="currentTab"
			:items="tabs"
			:label="$t('field', 1)"
			:orientation="wide ? 'vertical' : 'horizontal'"
			:class="{ 'min-h-0 flex-1 items-stretch! gap-0!': wide }"
			:list-class="wide ? 'box-content p-6' : undefined"
			:content-class="wide ? 'custom-scrollbar overflow-y-auto bg-(--project-tint) p-6 dark:bg-transparent' : undefined"
		>
			<template #content="{ item }">
				<AdvancedSchema v-if="item.value === 'schema'" />
				<AdvancedRelationship v-if="item.value === 'relationship'" />
				<AdvancedField v-if="item.value === 'field'" />
				<AdvancedInterface v-if="item.value === 'interface'" />
				<AdvancedDisplay v-if="item.value === 'display'" />
				<AdvancedValidation v-if="item.value === 'validation'" />
				<AdvancedConditions v-if="item.value === 'conditions'" />
			</template>
		</BoTabs>
	</div>
</template>
