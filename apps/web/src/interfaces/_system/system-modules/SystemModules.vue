<!-- Ported from directus/app/src/interfaces/_system/system-modules/system-modules.vue -->
<script setup lang="ts">
// Backoffice (spec 016 US5-4, recipe Q-25): BoSortableList (mouse drag and the D-96 Up/Down menu) instead of
// vuedraggable in a VList; module rows have a BoSwitch, the locked row a lock icon, link rows open the drawer on their
// name and have a named remove button. The default and the module list are those of DR 11.17.4, so a save writes
// what the DR app writes: the visual / deployments modules (D-41, owner 2026-10-21) and the DR documentation
// link (D-100, D-49) are kept in the data but not listed; the sidebar skips them too.
import type { DeepPartial, Field } from '@directus/types';
import { assign } from 'lodash-es';
import { nanoid } from 'nanoid';
import { computed, ref } from 'vue';
import BoButton from '../../../components/BoButton.vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoSortableList from '../../../components/BoSortableList.vue';
import BoSwitch from '../../../components/BoSwitch.vue';
import BoDrawer from '../../../components/drawers/BoDrawer.vue';
import BoForm from '../../../components/form/BoForm.vue';
import { DIRECTUS_DOCS_URL, type ModuleBarLink, type ModuleBarModule } from '../../../constants.ts';
import { translate } from '../../../utils/translate-object-values.ts';
import { DIRECTUS_MODULE_BAR_DEFAULT as MODULE_BAR_DEFAULT, OUT_OF_SCOPE_MODULES, useAllModules } from './modules.ts';

// @directus/types SettingsModuleBarLink / SettingsModuleBarModule (both may carry `locked`).
type SettingsModuleBarLink = ModuleBarLink & { locked?: boolean | undefined };
type SettingsModuleBarModule = Omit<ModuleBarModule, 'locked'> & { locked?: boolean | undefined };
type ModuleBar = (SettingsModuleBarLink | SettingsModuleBarModule)[];

type PreviewExtra = {
	to: string;
	name: string;
	icon: string;
};

type PreviewValue = (SettingsModuleBarLink & PreviewExtra) | (SettingsModuleBarModule & PreviewExtra);

const linkFields: DeepPartial<Field>[] = [
	{
		field: 'name',
		name: '$t:name',
		meta: {
			required: true,
			interface: 'input',
			width: 'half-left',
			options: {
				placeholder: '$t:enter_a_name',
			},
		},
	},
	{
		field: 'icon',
		name: '$t:icon',
		meta: {
			required: true,
			interface: 'select-icon',
			width: 'half-right',
		},
	},
	{
		field: 'url',
		name: '$t:url',
		meta: {
			required: true,
			interface: 'input',
			options: {
				placeholder: 'https://example.com',
			},
		},
	},
];

const props = withDefaults(
	defineProps<{
		value?: ModuleBar | null;
	}>(),
	{
		value: () => MODULE_BAR_DEFAULT,
	},
);

const emit = defineEmits<{
	(e: 'input', value: ModuleBar): void;
}>();

const editing = ref<string | null>();
const values = ref<SettingsModuleBarLink | null>();
const initialValues = ref<SettingsModuleBarLink | null>();

const allModules = useAllModules();

const availableModulesAsBarModule = computed<SettingsModuleBarModule[]>(() => {
	return allModules.value
		.filter((module) => module.hidden !== true)
		.map(
			(module): SettingsModuleBarModule => ({
				type: 'module',
				id: module.id,
				enabled: false,
			}),
		);
});

/** Kept in the data but not listed: the DR documentation link (D-100) and the modules without a port (D-41). */
function isHiddenPart(part: { type: string; id: string; url?: string }) {
	if (part.type === 'link') return part.id === 'docs' && part.url === DIRECTUS_DOCS_URL;
	return OUT_OF_SCOPE_MODULES.some((module) => module.id === part.id);
}

/** Every part as the DR app lists it: the saved bar, then the modules it does not have yet. */
const allValuesWithData = computed<PreviewValue[]>(() => {
	const savedModules = (
		(props.value ?? MODULE_BAR_DEFAULT).filter((value) => value.type === 'module') as SettingsModuleBarModule[]
	).map((value) => value.id);

	return valueToPreview([
		...(props.value ?? MODULE_BAR_DEFAULT),
		...availableModulesAsBarModule.value.filter(
			(availableModuleAsBarModule) => savedModules.includes(availableModuleAsBarModule.id) === false,
		),
	]);
});

const valuesWithData = computed<PreviewValue[]>({
	get() {
		return allValuesWithData.value.filter((part) => !isHiddenPart(part));
	},
	set(previewValue: PreviewValue[]) {
		// The hidden parts go back at their place, so the saved value is what the DR app writes (valueToPreview
		// translates link names: DR writes the translated name).
		const value = [...previewValue];
		allValuesWithData.value.forEach((part, index) => {
			if (isHiddenPart(part)) value.splice(Math.min(index, value.length), 0, part);
		});
		emit('input', previewToValue(value));
	},
});

const isSaveDisabled = computed(() => {
	// Backoffice: BoDrawer keeps its actions mounted while closed, after `save` cleared the values.
	if (!values.value) return true;

	for (const field of linkFields) {
		if (field.meta?.required && field.field) {
			const fieldValue = (values.value as Record<string, any>)[field.field];
			if (fieldValue === null || fieldValue === undefined || fieldValue === '') return true;
		}
	}

	return false;
});

function valueToPreview(value: ModuleBar): PreviewValue[] {
	return value.flatMap((part): PreviewValue[] => {
		if (part.type === 'link') {
			return [{ ...part, to: part.url, icon: part.icon, name: translate(part.name) }];
		}

		const module = allModules.value.find((module) => module.id === part.id);
		if (!module) return [];

		return [{ ...part, to: `/${module.id}`, name: module.name, icon: module.icon }];
	});
}

function previewToValue(preview: PreviewValue[]): ModuleBar {
	return preview.map((previewValue) => {
		if (previewValue.type === 'link') {
			const { type, id, name, url, icon, enabled, locked } = previewValue;
			return { type, id, name, url, icon, enabled, locked };
		}

		const { type, id, enabled, locked } = previewValue;
		return { type, id, enabled, locked };
	});
}

function updateItem(item: PreviewValue, updates: Partial<PreviewValue>): void {
	valuesWithData.value = valuesWithData.value.map((previewValue) => {
		if (previewValue === item) {
			return assign({}, item, updates);
		}

		return previewValue;
	});
}

function edit(id: string) {
	editing.value = id;

	let value: SettingsModuleBarLink;

	if (id !== '+') {
		value = (props.value ?? MODULE_BAR_DEFAULT).find((val) => val.id === id) as SettingsModuleBarLink;
	} else {
		value = {
			id: nanoid(),
			type: 'link',
			enabled: true,
			url: '',
			name: '',
			icon: '',
		};
	}

	values.value = value;
	initialValues.value = value;
}

function save() {
	if (isSaveDisabled.value) return;

	if (editing.value === '+') {
		emit('input', [...(props.value ?? MODULE_BAR_DEFAULT), values.value!]);
	} else {
		emit(
			'input',
			(props.value ?? MODULE_BAR_DEFAULT).map((val) => (val.id === editing.value ? values.value! : val)),
		);
	}

	values.value = null;
	editing.value = null;
}

function remove(id: string) {
	emit(
		'input',
		(props.value ?? MODULE_BAR_DEFAULT).filter((val) => val.id !== id),
	);
}

const LINK_BUTTON =
	'cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div class="system-modules flex flex-col gap-3">
		<BoSortableList v-model="valuesWithData" item-key="id" :item-label="(item: PreviewValue) => item.name">
			<template #item="{ element }">
				<div class="flex min-w-0 flex-1 items-center gap-3" :class="{ enabled: element.enabled }">
					<BoIcon class="icon shrink-0 text-gray-500 dark:text-gray-400" :name="element.icon" />
					<component
						:is="element.type === 'link' ? 'button' : 'div'"
						v-bind="element.type === 'link' ? { type: 'button' } : {}"
						class="info min-w-0 flex-1 text-start"
						:class="element.type === 'link' ? LINK_BUTTON : ''"
						@click="element.type === 'link' ? edit(element.id) : undefined"
					>
						<div class="name truncate text-theme-sm text-gray-800 dark:text-white/90">{{ element.name }}</div>
						<div class="to truncate font-mono text-theme-xs text-gray-500 dark:text-gray-400">{{ element.to }}</div>
					</component>
					<BoIcon v-if="element.locked === true" name="lock" class="shrink-0 text-gray-500 dark:text-gray-400" />
					<BoButton
						v-else-if="element.type === 'link'"
						variant="ghost"
						icon="clear"
						:aria-label="`${$t('remove')} ${element.name}`"
						:title="$t('remove')"
						@click.stop="remove(element.id)"
					/>
					<BoSwitch
						v-else
						:model-value="element.enabled"
						:label="element.name"
						class="[&_label]:sr-only"
						@update:model-value="updateItem(element, { enabled: !element.enabled })"
					/>
				</div>
			</template>
		</BoSortableList>

		<div>
			<BoButton variant="secondary" icon="add_link" @click="edit('+')">{{ $t('add_link') }}</BoButton>
		</div>

		<BoDrawer
			:title="$t('custom_link')"
			:model-value="!!editing"
			icon="link"
			@update:model-value="editing = null"
			@cancel="editing = null"
			@apply="save"
		>
			<template #actions>
				<BoButton icon="check" :aria-label="$t('save')" :title="$t('save')" :disabled="isSaveDisabled" @click="save" />
			</template>

			<div class="drawer-content p-6">
				<BoForm
					:model-value="(values ?? {}) as never"
					:initial-values="(initialValues ?? null) as never"
					:fields="linkFields as Field[]"
					@update:model-value="values = $event as never"
				/>
			</div>
		</BoDrawer>
	</div>
</template>
