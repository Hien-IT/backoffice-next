<!-- Ported from directus/app/src/modules/settings/routes/flows/flow-drawer.vue -->
<script setup lang="ts">
// Backoffice (spec 017 FR-012, recipe Q-33): VDrawer is BoDrawer (persistent, `apply` = meta+Enter), the sidebar tabs
// are a vertical BoTabs from 1024 px (horizontal above the content below, as the field drawer of 016), VSelect is
// BoSelect, VFancySelect is BoFancySelect, VForm is BoForm, the header action buttons are BoButton. api.post/patch go
// through the SDK (`fields=id`: the SDK joins arrays, research R9). Errors open the error dialog (D-66).
import type { TriggerType } from '@directus/types';
import { useMediaQuery } from '@vueuse/core';
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../../api/sdk.ts';
import BoButton from '../../../../components/BoButton.vue';
import BoFancySelect from '../../../../components/BoFancySelect.vue';
import BoInput from '../../../../components/BoInput.vue';
import BoSelect from '../../../../components/BoSelect.vue';
import BoTabs from '../../../../components/BoTabs.vue';
import BoDrawer from '../../../../components/drawers/BoDrawer.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import { showUnexpectedError } from '../../../../composables/use-notices.ts';
import SelectColor from '../../../../interfaces/select-color/SelectColor.vue';
import SelectIcon from '../../../../interfaces/select-icon/SelectIcon.vue';
import { useFlowsStore } from '../../../../stores/flows.ts';
import { getTriggers } from './triggers.ts';

interface Values {
	name: string | null;
	icon: string | null;
	color: string | null;
	description: string | null;
	status: string;
	accountability: string | null;
	trigger?: TriggerType | null | undefined;
	options: Record<string, any>;
}

const props = withDefaults(
	defineProps<{
		primaryKey?: string;
		active: boolean;
		startTab?: string;
	}>(),
	{ primaryKey: '+', startTab: 'flow_setup' },
);

const emit = defineEmits<{ cancel: []; done: [id: string] }>();

const { t } = useI18n();

const flowsStore = useFlowsStore();

const currentTab = ref('flow_setup');

const isNew = computed(() => props.primaryKey === '+');

const values: Values = reactive({
	name: null,
	icon: 'bolt',
	color: null,
	description: null,
	status: 'active',
	accountability: 'all',
	trigger: undefined,
	options: {},
});

watch(
	() => props.primaryKey,
	(newKey) => {
		currentTab.value = props.startTab;

		if (newKey === '+') {
			values.name = null;
			values.icon = 'bolt';
			values.color = null;
			values.description = null;
			values.status = 'active';
			values.accountability = 'all';
			values.trigger = undefined;
			values.options = {};
		} else {
			const existing = flowsStore.flows.find((existingFlow) => existingFlow.id === newKey)!;

			values.name = existing.name;
			values.icon = existing.icon;
			values.color = existing.color;
			values.description = existing.description;
			values.status = existing.status;
			values.accountability = existing.accountability;
			values.trigger = existing.trigger;
			values.options = existing.options ?? {};
		}
	},
	{ immediate: true },
);

// Backoffice: also when the drawer opens again on the same flow (Directus remounts it), start from the stored values.
watch(
	() => props.active,
	(active, wasActive) => {
		if (active && !wasActive && !isNew.value) {
			const existing = flowsStore.flows.find((existingFlow) => existingFlow.id === props.primaryKey);
			if (existing) Object.assign(values, { ...existing, options: existing.options ?? {} });
			currentTab.value = props.startTab;
		}
	},
);

watch(
	() => values.trigger,
	(_, previousTrigger) => {
		if (previousTrigger === undefined) return;

		values.options = {};
	},
);

watch(
	() => values.options?.['type'],
	(type, previousType) => {
		if (previousType === undefined) return;

		values.options = {
			type,
		};
	},
);

const { triggers } = getTriggers();

const triggerItems = computed(() =>
	triggers.map((trigger) => ({
		value: trigger.id,
		text: trigger.name,
		icon: trigger.icon,
		description: trigger.description,
	})),
);

const currentTrigger = computed(() => triggers.find((trigger) => trigger.id === values.trigger));

const isFlowSetupDisabled = computed(() => !values.name || values.name.length === 0);
const isFlowTriggerDisabled = computed(() => !values.trigger);

const currentTriggerOptionFields = computed(() => {
	if (!currentTrigger.value) return [];

	if (typeof currentTrigger.value.options === 'function') {
		return currentTrigger.value.options(values.options);
	}

	return currentTrigger.value.options;
});

const tabs = computed(() => [
	{ value: 'flow_setup', label: t('flow_setup') },
	{ value: 'trigger_setup', label: t('trigger_setup'), disabled: !values.name },
]);

const wide = useMediaQuery('(min-width: 1024px)');

const saving = ref(false);

/** The body the Directus drawer sends: every value, in its order (Directus posts the reactive `values`). */
function body(): Record<string, unknown> {
	const { name, icon, color, description, status, accountability, trigger, options } = values;
	return { name, icon, color, description, status, accountability, trigger, options };
}

async function save() {
	saving.value = true;

	try {
		let id: string;

		if (isNew.value) {
			id = (
				await sdk.request<{ id: string }>(
					requestEndpoint('/flows', { method: 'POST', body: body(), params: { fields: ['id'] } }),
				)
			).id;
		} else {
			id = (
				await sdk.request<{ id: string }>(
					requestEndpoint(`/flows/${props.primaryKey}`, { method: 'PATCH', body: body(), params: { fields: ['id'] } }),
				)
			).id;
		}

		await flowsStore.hydrate();

		emit('done', id);
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		saving.value = false;
	}
}

function onApplyFlowSetup() {
	if (isFlowSetupDisabled.value || saving.value) return;

	if (!isNew.value) {
		save();
		return;
	}

	currentTab.value = 'trigger_setup';
}

function onApply() {
	if (saving.value) return;

	if (currentTab.value === 'trigger_setup' && !isFlowTriggerDisabled.value) {
		save();
		return;
	}

	if (currentTab.value !== 'flow_setup') return;

	onApplyFlowSetup();
}

// BoSelect (Reka Select) has no empty value: `null` ("do not track") goes through a sentinel.
const NO_TRACKING = '$null';
const accountability = computed({
	get: () => values.accountability ?? NO_TRACKING,
	set: (value: string) => (values.accountability = value === NO_TRACKING ? null : value),
});

const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
</script>

<template>
	<BoDrawer
		:model-value="active"
		:title="isNew ? $t('creating_new_flow') : $t('updating_flow')"
		icon="bolt"
		persistent
		@cancel="emit('cancel')"
		@apply="onApply"
		@update:model-value="!$event && emit('cancel')"
	>
		<template #actions>
			<BoButton
				v-if="currentTab === 'flow_setup'"
				:icon="isNew ? 'arrow_forward' : 'check'"
				:aria-label="isNew ? $t('next') : $t('save')"
				:title="isNew ? $t('next') : $t('save')"
				:disabled="isFlowSetupDisabled"
				:loading="saving"
				@click="onApplyFlowSetup"
			/>

			<BoButton
				v-if="currentTab === 'trigger_setup'"
				icon="check"
				:aria-label="isNew ? $t('finish_setup') : $t('save')"
				:title="isNew ? $t('finish_setup') : $t('save')"
				:disabled="isFlowTriggerDisabled"
				:loading="saving"
				@click="save"
			/>
		</template>

		<div class="p-6">
			<BoTabs
				v-model="currentTab"
				:items="tabs"
				:label="isNew ? $t('creating_new_flow') : $t('updating_flow')"
				:orientation="wide ? 'vertical' : 'horizontal'"
			>
				<template #content="{ item }">
					<div v-if="item.value === 'flow_setup'" class="grid grid-cols-2 gap-x-6 gap-y-5">
						<div>
							<label for="flow-drawer-name" :class="LABEL">
								{{ $t('flow_name') }}
								<span class="text-error-600 dark:text-error-400" aria-hidden="true">*</span>
								<span class="sr-only">({{ $t('required') }})</span>
							</label>
							<BoInput id="flow-drawer-name" v-model="values.name" autofocus :placeholder="$t('flow_name')" />
						</div>
						<BoSelect
							v-model="values.status"
							:label="$t('status')"
							:items="[
								{ text: $t('active'), value: 'active' },
								{ text: $t('inactive'), value: 'inactive' },
							]"
						/>
						<BoInput
							v-model="values.description"
							class="col-span-2"
							:label="$t('description')"
							:placeholder="$t('description')"
						/>
						<div>
							<p :class="LABEL">{{ $t('icon') }}</p>
							<SelectIcon :value="values.icon" @input="values.icon = $event" />
						</div>
						<div>
							<p :class="LABEL">{{ $t('color') }}</p>
							<SelectColor width="half" :value="values.color" @input="values.color = $event" />
						</div>
						<hr class="col-span-2 m-0 border-gray-200 dark:border-gray-800" />
						<BoSelect
							v-model="accountability"
							class="col-span-2"
							:label="$t('flow_tracking')"
							:items="[
								{ text: $t('flow_tracking_all'), value: 'all' },
								{ text: $t('flow_tracking_activity'), value: 'activity' },
								{ text: $t('flow_tracking_null'), value: NO_TRACKING },
							]"
						/>
					</div>

					<div v-else class="flex flex-col gap-7">
						<BoFancySelect
							:model-value="values.trigger ?? null"
							:items="triggerItems"
							@update:model-value="values.trigger = $event as TriggerType | null"
						/>

						<BoForm
							v-if="values.trigger"
							v-model="values.options"
							:fields="currentTriggerOptionFields as never"
							primary-key="+"
						/>
					</div>
				</template>
			</BoTabs>
		</div>
	</BoDrawer>
</template>
