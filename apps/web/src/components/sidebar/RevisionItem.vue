<!-- Ported from directus/app/src/views/private/components/revision-item.vue -->
<script setup lang="ts">
// Backoffice: recipe Q-10 row (button, action dot with the action written, time, user). The user name is plain text
// inside the row button: Directus nests a user popover button in it, which is not valid HTML.
import { format } from 'date-fns';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFieldsStore } from '../../stores/fields.ts';
import type { Revision } from '../../types/revisions.ts';
import { getRevisionFields } from '../../utils/get-revision-fields.ts';
import { userName } from '../../utils/user-name.ts';

const props = defineProps<{
	revision: Revision;
	last?: boolean;
}>();

defineEmits<{
	(e: 'click'): void;
}>();

const { t } = useI18n();

const fieldsStore = useFieldsStore();
const fields = fieldsStore.getFieldsForCollection(props.revision.collection);

const revisionCount = computed(() => {
	const revisionDelta = Object.keys(props.revision.delta ?? {});
	const revisionFields = getRevisionFields(revisionDelta, fields);
	return revisionFields.length;
});

const headerMessage = computed(() => {
	switch (props.revision.activity.action.toLowerCase()) {
		case 'create':
			return t('revision_delta_created');
		case 'update':
			return t('revision_delta_updated', revisionCount.value);
		case 'delete':
			return t('revision_delta_deleted');
		case 'version_save':
			return t('revision_delta_updated', revisionCount.value);
		case 'revert':
			return t('revision_delta_reverted');
		default:
			return t('revision_delta_other');
	}
});

const time = computed(() => {
	return format(new Date(props.revision.activity.timestamp), String(t('date-fns_time')));
});

const user = computed(() => {
	if (props.revision?.activity?.user && typeof props.revision.activity.user === 'object') {
		return userName(props.revision.activity.user);
	}

	return t('private_user');
});

// Backoffice: recipe Q-10 dot colors (Directus: primary for create/update/version_save, danger for delete).
const DOT: Record<string, string> = {
	create: 'bg-success-500',
	update: 'bg-brand-500',
	delete: 'bg-error-500',
	version_save: 'bg-warning-500',
};
</script>

<template>
	<button
		type="button"
		class="flex w-full gap-3 rounded-lg px-2 py-2 text-start hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400"
		:data-last="last ? '' : undefined"
		@click="$emit('click')"
	>
		<span
			class="mt-1.5 size-2 shrink-0 rounded-full"
			:class="DOT[revision.activity.action] ?? 'bg-warning-500'"
			aria-hidden="true"
		/>
		<span class="min-w-0">
			<span class="block text-theme-sm font-medium text-gray-800 dark:text-white/90">{{ headerMessage }}</span>
			<span class="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
				<span class="lowercase tabular-nums">{{ time }}</span>
				–
				<span>{{ revision.activity.user ? user : $t('private_user') }}</span>
			</span>
		</span>
	</button>
</template>
