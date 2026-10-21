<!-- Ported from directus/app/src/modules/settings/routes/extensions/components/extension-group-divider.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-41): the group title in the uppercase small style of the recipe, the type icon before it.
import { pluralize } from '@directus/utils';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from '../../../../../components/BoIcon.vue';
import { extensionTypeIconMap } from '../constants.ts';
import type { ExtensionType } from '../types.ts';

const props = defineProps<{
	type: ExtensionType;
}>();

const { t } = useI18n();

const label = computed(() => t(`extension_${props.type !== 'missing' ? pluralize(props.type) : props.type}`));
const icon = computed(() => extensionTypeIconMap[props.type]);
</script>

<template>
	<h2
		class="m-0 mt-6 mb-2 flex items-center gap-2 border-b border-gray-200 pb-2 text-theme-xs font-medium tracking-wide text-gray-500 uppercase dark:border-gray-800 dark:text-gray-400"
	>
		<BoIcon :name="icon" size="sm" />
		{{ label }}
	</h2>
</template>
