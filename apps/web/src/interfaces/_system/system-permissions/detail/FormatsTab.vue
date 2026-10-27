<!-- Backoffice (spec 025, FR-017, FR-026): the file formats an import or export permission allows. -->
<script setup lang="ts">
// No format checked is every format (`options` null); the checked ones go to `options.formats`.
import type { Permission } from '@directus/types';
import { computed } from 'vue';
import BoCheckbox from '../../../../components/BoCheckbox.vue';
import { type BackofficeAction, backofficeActions } from '../app-permissions.ts';

type FormatsPermission = Permission & { options?: { formats?: string[] } | null };

const props = defineProps<{ permission: FormatsPermission }>();

const emit = defineEmits<{ 'update:permission': [FormatsPermission] }>();

const formats = computed(
	() => backofficeActions[props.permission.action as unknown as BackofficeAction]?.formats ?? [],
);
const checked = computed(() => props.permission.options?.formats ?? []);

function toggle(format: string, on: boolean) {
	const next = formats.value.filter((value) => (value === format ? on : checked.value.includes(value)));
	emit('update:permission', { ...props.permission, options: next.length > 0 ? { formats: next } : null });
}
</script>

<template>
	<fieldset class="formats flex flex-col gap-3">
		<legend class="mb-2 text-theme-sm text-gray-500 dark:text-gray-400">{{ $t('bo_formats_hint') }}</legend>
		<BoCheckbox
			v-for="format in formats"
			:key="format"
			:label="$t(format)"
			:model-value="checked.includes(format)"
			@update:model-value="toggle(format, $event)"
		/>
	</fieldset>
</template>
