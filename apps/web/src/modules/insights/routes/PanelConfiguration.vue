<!-- Ported from directus/app/src/modules/insights/routes/panel-configuration.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-029 to FR-032, recipe Q-37, research R6): VDrawer is BoDrawer (persistent, `apply` =
// meta+Enter), the type grid is BoFancySelect `layout="grid"` without the preview images (D-110) and without the
// Directus `configRow` placement (the options follow the grid); the types come from the static registry (no
// extensions, XI) translated here. Choosing another type resets the options (FR-030); a new panel starts without
// a header, as Directus (no `show_header` sent, the column default is false; T002 baseline, FR-032). Done moves the focus to the tile that was created or edited (FR-029).
import type { Field, Panel } from '@directus/types';
import { assign, clone, isUndefined, omitBy } from 'lodash-es';
import { nanoid } from 'nanoid/non-secure';
import { storeToRefs } from 'pinia';
import { computed, onUnmounted, reactive, shallowRef, unref } from 'vue';
import { useRouter } from 'vue-router';
import BoButton from '../../../components/BoButton.vue';
import BoCheckbox from '../../../components/BoCheckbox.vue';
import BoDivider from '../../../components/BoDivider.vue';
import BoFancySelect from '../../../components/BoFancySelect.vue';
import BoInput from '../../../components/BoInput.vue';
import BoDrawer from '../../../components/drawers/BoDrawer.vue';
import { useDialogRoute } from '../../../composables/use-dialog-route.ts';
import SelectColor from '../../../interfaces/select-color/SelectColor.vue';
import SelectIcon from '../../../interfaces/select-icon/SelectIcon.vue';
import type { PanelConfig } from '../../../panels/types.ts';
import { type CreatePanel, loadPanelRegistry, useInsightsStore } from '../../../stores/insights.ts';
import { translate } from '../../../utils/translate-object-values.ts';
import ExtensionOptions from '../../settings/routes/data-model/field-detail/shared/ExtensionOptions.vue';

const props = defineProps<{
	primaryKey: string;
	panelKey: string;
}>();

const isOpen = useDialogRoute();

const edits = reactive<{ [K in keyof Panel]?: Panel[K] | undefined }>({
	show_header: undefined,
	type: undefined,
	name: undefined,
	note: undefined,
	icon: undefined,
	color: undefined,
	width: undefined,
	height: undefined,
	position_x: undefined,
	position_y: undefined,
	options: undefined,
});

const insightsStore = useInsightsStore();

const { panels } = storeToRefs(insightsStore);

const panelTypes = shallowRef<PanelConfig[]>([]);
loadPanelRegistry().then((registry) => (panelTypes.value = registry.getPanels().map((type) => translate(type))));

const router = useRouter();

const panel = computed<Partial<Panel>>(() => {
	if (props.panelKey === '+') return omitBy(edits, isUndefined);
	const existing: Partial<Panel> = unref(panels).find((panel) => panel.id === props.panelKey) ?? {};
	return assign({}, existing, omitBy(edits, isUndefined));
});

const currentTypeInfo = computed(() => panelTypes.value.find((type) => type.id === panel.value.type));

// Backoffice: ExtensionOptions gets the fields itself (type `panel`, as the 017 operations): the array, or the result
// of the options function called with the panel as Directus does.
const customOptionsFields = computed(() => {
	const options = currentTypeInfo.value?.options;
	const fields = typeof options === 'function' ? options(unref(panel)) : options;
	return fields ? (translate(fields) as Field[]) : undefined;
});

const typeItems = computed(() =>
	panelTypes.value.map((type) => ({
		value: type.id,
		icon: type.icon,
		text: type.name,
		description: type.description,
	})),
);

function selectType(id: string | number | null) {
	edits.type = (id as string | null) ?? undefined;
	edits.options = {};
}

let focusTile: string | null = null;

const back = () => router.push({ name: 'insights-dashboard', params: { primaryKey: props.primaryKey } });

const stageChanges = () => {
	if (!panel.value.type) return;

	if (props.panelKey === '+') {
		const createPanel = clone(unref(panel));

		createPanel.id = `_${nanoid()}`;
		createPanel.dashboard = props.primaryKey;
		createPanel.width ??= unref(currentTypeInfo)?.minWidth ?? 4;
		createPanel.height ??= unref(currentTypeInfo)?.minHeight ?? 4;
		createPanel.position_x ??= 1;
		createPanel.position_y ??= 1;
		createPanel.options ??= {};

		insightsStore.stagePanelCreate(unref(createPanel as CreatePanel));
		focusTile = createPanel.id;
	} else {
		insightsStore.stagePanelUpdate({ id: props.panelKey, edits: unref(panel) });
		focusTile = props.panelKey;
	}

	back();
};

// After the drawer gave the focus back to its opener (BoDrawer), move it to the tile's edit button.
onUnmounted(() => {
	if (!focusTile) return;
	const id = focusTile;
	setTimeout(() => document.querySelector<HTMLElement>(`[data-tile-id="${id}"] button`)?.focus());
});

const LABEL = 'mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90';
</script>

<template>
	<BoDrawer
		:model-value="isOpen"
		:title="panel.name || currentTypeInfo?.name || $t('panel')"
		:subtitle="$t('panel_options')"
		:icon="panel.icon || currentTypeInfo?.icon || 'insert_chart'"
		persistent
		@cancel="back"
		@apply="stageChanges"
	>
		<template #actions>
			<BoButton
				icon="check"
				:aria-label="$t('done')"
				:title="$t('done')"
				:disabled="!panel.type"
				data-action="done"
				@click="stageChanges"
			/>
		</template>

		<div class="flex flex-col gap-6 p-6">
			<BoFancySelect
				layout="grid"
				:model-value="currentTypeInfo ? (panel.type ?? null) : null"
				:items="typeItems"
				@update:model-value="selectType"
			/>

			<template v-if="panel.type && currentTypeInfo">
				<ExtensionOptions
					:model-value="panel.options"
					:options="customOptionsFields"
					type="panel"
					:extension="panel.type"
					raw-editor-enabled
					@update:model-value="edits.options = $event"
				/>

				<BoDivider icon="info" :title="$t('panel_header')" />

				<div class="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
					<div>
						<p :class="LABEL">{{ $t('visible') }}</p>
						<BoCheckbox
							:model-value="panel.show_header"
							:label="$t('show_header')"
							@update:model-value="edits.show_header = $event"
						/>
					</div>

					<BoInput
						:model-value="panel.name ?? null"
						:label="$t('name')"
						:disabled="panel.show_header !== true"
						:placeholder="$t('panel_name_placeholder')"
						@update:model-value="edits.name = $event"
					/>

					<div>
						<p :class="LABEL">{{ $t('icon') }}</p>
						<SelectIcon
							:value="panel.icon ?? null"
							:disabled="panel.show_header !== true"
							@input="edits.icon = $event"
						/>
					</div>

					<div>
						<p :class="LABEL">{{ $t('color') }}</p>
						<SelectColor
							:value="panel.color ?? null"
							:disabled="panel.show_header !== true"
							width="half"
							@input="edits.color = $event"
						/>
					</div>

					<div class="md:col-span-2">
						<BoInput
							:model-value="panel.note ?? null"
							:label="$t('note')"
							:disabled="panel.show_header !== true"
							:placeholder="$t('panel_note_placeholder')"
							@update:model-value="edits.note = $event"
						/>
					</div>
				</div>
			</template>
		</div>
	</BoDrawer>
</template>
