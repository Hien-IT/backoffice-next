<!-- Ported from directus/app/src/modules/insights/components/dashboard-dialog.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-011, US1-3): VDialog persistent -> BoDialog persistent (a form, so Enter saves as Directus
// @apply); fields get visible labels (Directus has placeholders only, XII label rule). api -> SDK; errors keep the dialog
// open with the values and open the error dialog. The `activator` slot is left out: callers open it with v-model.
import { isEqual } from 'lodash-es';
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoButton from '../../../components/BoButton.vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoInput from '../../../components/BoInput.vue';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import SelectColor from '../../../interfaces/select-color/SelectColor.vue';
import SelectIcon from '../../../interfaces/select-icon/SelectIcon.vue';
import { type Dashboard, useInsightsStore } from '../../../stores/insights.ts';

const props = defineProps<{
	modelValue?: boolean;
	dashboard?: Dashboard | undefined;
}>();

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void;
}>();

const router = useRouter();
const insightsStore = useInsightsStore();

const values = reactive({
	name: props.dashboard?.name ?? null,
	icon: props.dashboard?.icon ?? 'dashboard',
	color: props.dashboard?.color ?? null,
	note: props.dashboard?.note ?? null,
});

const isSaveDisabled = computed(() => !values.name);

watch(
	() => props.modelValue,
	(newValue, oldValue) => {
		if (isEqual(newValue, oldValue) === false) {
			values.name = props.dashboard?.name ?? null;
			values.icon = props.dashboard?.icon ?? 'space_dashboard';
			values.color = props.dashboard?.color ?? null;
			values.note = props.dashboard?.note ?? null;
		}
	},
);

const saving = ref(false);

function cancel() {
	emit('update:modelValue', false);
}

async function save() {
	if (isSaveDisabled.value || saving.value) return;

	saving.value = true;

	try {
		if (props.dashboard) {
			await sdk.request(
				requestEndpoint(`/dashboards/${props.dashboard.id}`, {
					method: 'PATCH',
					body: { ...values },
					params: { fields: ['id'] },
				}),
			);
			await insightsStore.hydrate();
		} else {
			const created = await sdk.request<{ id: string }>(
				requestEndpoint('/dashboards', { method: 'POST', body: { ...values }, params: { fields: ['id'] } }),
			);
			await insightsStore.hydrate();
			router.push({ name: 'insights-dashboard', params: { primaryKey: created.id } });
		}

		emit('update:modelValue', false);
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}

const open = computed({
	get: () => props.modelValue ?? false,
	set: (value: boolean) => emit('update:modelValue', value),
});

const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
</script>

<template>
	<BoDialog v-model:open="open" :title="dashboard ? $t('edit_dashboard') : $t('create_dashboard')" persistent>
		<form id="dashboard-dialog-form" class="grid grid-cols-2 gap-x-6 gap-y-5" @submit.prevent="save">
			<BoInput
				v-model="values.name"
				class="col-span-2"
				autofocus
				:label="$t('dashboard_name')"
				:placeholder="$t('dashboard_name')"
			/>
			<div>
				<p :class="LABEL">{{ $t('icon') }}</p>
				<SelectIcon :value="values.icon" @input="values.icon = $event" />
			</div>
			<div>
				<p :class="LABEL">{{ $t('color') }}</p>
				<SelectColor width="half" :value="values.color" @input="values.color = $event" />
			</div>
			<BoInput v-model="values.note" class="col-span-2" :label="$t('note')" :placeholder="$t('note')" />
		</form>

		<template #actions>
			<BoButton variant="secondary" @click="cancel">{{ $t('cancel') }}</BoButton>
			<BoButton type="submit" form="dashboard-dialog-form" :disabled="isSaveDisabled" :loading="saving">
				{{ $t('save') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
