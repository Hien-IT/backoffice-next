<!-- Ported from directus/app/src/interfaces/_system/system-language/system-language.vue -->
<script setup lang="ts">
// Backoffice: VSelect is BoSelect, linked to the form label by the FormField ids (FR-094). Reka Select values cannot be
// null or '', so the "project default" item (null) uses a sentinel value. A stored code missing from the list shows
// as it is (D-46).
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import BoSelect from '../../../components/BoSelect.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import availableLanguages from '../../../lang/available-languages.json';

const props = defineProps<{
	value: string | null;
	disabled?: boolean;
	includeProjectDefault?: boolean;
}>();

const emit = defineEmits<{
	(e: 'input', value: string | null): void;
}>();

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);

const PROJECT_DEFAULT = '$project_default';

const languages = Object.entries(availableLanguages).map(([key, value]) => ({
	text: value,
	value: key,
}));

if (props.includeProjectDefault) {
	languages.splice(0, 0, { text: t('fields.directus_settings.default_language'), value: PROJECT_DEFAULT });
}

const items = computed(() =>
	props.value && !languages.some((language) => language.value === props.value)
		? [...languages, { text: props.value, value: props.value }]
		: languages,
);

const modelValue = computed(() => props.value ?? (props.includeProjectDefault ? PROJECT_DEFAULT : null));
</script>

<template>
	<BoSelect
		:id="a11y?.inputId"
		:model-value="modelValue"
		:items="items"
		:disabled="!!disabled"
		:placeholder="$t('language_placeholder')"
		@update:model-value="emit('input', $event === PROJECT_DEFAULT ? null : $event)"
	/>
</template>
