<!-- Ported from directus/app/src/views/private/components/drawer-batch.vue -->
<script setup lang="ts">
// Backoffice: only the `stageOnSave` path: the edits are always emitted with `input` for the parent's changes. The
// direct save (PATCH <endpoint> with keys, translations merge, `refresh` event) writes outside the FR-054 list and
// comes with the item screens (014); `stageOnSave` is kept so Directus callers bind the same props.
import type { PrimaryKey } from '@directus/types';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BoButton from '../BoButton.vue';
import BoForm from '../form/BoForm.vue';
import BoDrawer from './BoDrawer.vue';

const props = withDefaults(
	defineProps<{
		collection: string;
		primaryKeys: PrimaryKey[];
		active?: boolean | undefined;
		edits?: Record<string, any> | undefined;
		stageOnSave?: boolean;
	}>(),
	{ active: undefined, edits: undefined },
);

const emit = defineEmits<{
	(e: 'update:active', value: boolean): void;
	(e: 'input', value: Record<string, any>): void;
}>();

const { t } = useI18n();

const { internalEdits } = useEdits();
const { internalActive } = useActiveState();
const { save, cancel } = useActions();

function useEdits() {
	const localEdits = ref<Record<string, any>>({});

	const internalEdits = computed<Record<string, any>>({
		get() {
			if (props.edits !== undefined) {
				return {
					...props.edits,
					...localEdits.value,
				};
			}

			return localEdits.value;
		},
		set(newEdits) {
			localEdits.value = newEdits;
		},
	});

	return { internalEdits };
}

function useActiveState() {
	const localActive = ref(false);

	const internalActive = computed({
		get() {
			return props.active === undefined ? localActive.value : props.active;
		},
		set(newActive: boolean) {
			localActive.value = newActive;
			emit('update:active', newActive);
		},
	});

	return { internalActive };
}

function useActions() {
	return { save, cancel };

	function save() {
		emit('input', internalEdits.value);
		internalActive.value = false;
		internalEdits.value = {};
	}

	function cancel() {
		internalActive.value = false;
		internalEdits.value = {};
	}
}

defineExpose({ save, cancel });
</script>

<template>
	<BoDrawer
		v-model="internalActive"
		:title="t('editing_in_batch', { count: primaryKeys.length })"
		persistent
		@cancel="cancel"
		@apply="save"
	>
		<template #actions>
			<BoButton icon="check" :aria-label="t('save')" @click="save" />
		</template>

		<BoForm v-model="internalEdits" :collection="collection" batch-mode primary-key="+" />
	</BoDrawer>
</template>
