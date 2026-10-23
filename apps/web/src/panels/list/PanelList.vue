<!-- Ported from directus/app/src/panels/list/panel-list.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-042..FR-046, recipe Q-36): v-list/v-list-item become a `ul`/`li` list; with `linkToItem` a
// row is a `button` (keyboard access, focus ring) instead of a clickable div; borders `border-gray-100
// dark:border-gray-800` instead of `--theme--border-color-subdued`; the PATCH goes through the SDK (`requestEndpoint`)
// and errors through showUnexpectedError; no own side padding (PanelTile pads the body). `inheritAttrs: false` (as the
// DR label panel) keeps the tile context props it does not declare out of the DOM. Logic as DR: a click
// opens the item drawer, its input PATCHes the item, then the dashboard is refreshed (also after an error).
import { getEndpoint } from '@directus/utils';
import { computed, ref } from 'vue';
import { requestEndpoint, sdk } from '../../api/sdk.ts';
import DrawerItem from '../../components/drawers/DrawerItem.vue';
import RenderTemplate from '../../components/render/RenderTemplate.vue';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useInsightsStore } from '../../stores/insights.ts';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
	defineProps<{
		showHeader?: boolean;
		displayTemplate?: string;
		linkToItem?: boolean;
		collection: string;
		dashboard: string;
		data?: Record<string, any>[];
	}>(),
	{
		showHeader: false,
		displayTemplate: '',
		linkToItem: false,
		data: () => [],
	},
);

const FOCUS =
	'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';

const currentlyEditing = ref<number | string>();
const editsAtStart = ref<Record<string, any>>();

const fieldsStore = useFieldsStore();
const insightsStore = useInsightsStore();

const primaryKeyField = computed(() => fieldsStore.getPrimaryKeyFieldForCollection(props.collection)?.field ?? 'id');

function startEditing(item: Record<string, any>) {
	if (!props.linkToItem) return;
	currentlyEditing.value = item[primaryKeyField.value];
}

function cancelEdit() {
	editsAtStart.value = undefined;
	currentlyEditing.value = undefined;
}

async function saveEdits(item: Record<string, any>) {
	try {
		await sdk.request(
			requestEndpoint(`${getEndpoint(props.collection)}/${currentlyEditing.value}`, { method: 'PATCH', body: item }),
		);
	} catch (error) {
		showUnexpectedError(error);
	}

	await insightsStore.refresh(props.dashboard);
}
</script>

<template>
	<!-- Backoffice (FR-106): the body scrolls when the rows overflow, so it takes the keyboard focus (axe
	     scrollable-region-focusable). -->
	<div
		class="size-full overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		:class="{ 'has-header': showHeader }"
		tabindex="0"
	>
		<ul>
			<li
				v-for="row in data"
				:key="row[primaryKeyField]"
				class="h-[2.6875rem] border-t border-gray-100 last:border-b dark:border-gray-800"
			>
				<component
					:is="linkToItem === true ? 'button' : 'div'"
					:type="linkToItem === true ? 'button' : undefined"
					class="flex size-full items-center px-[0.3125rem] text-start text-theme-sm text-gray-800 dark:text-white/90"
					:class="linkToItem === true ? ['cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5', FOCUS] : undefined"
					data-list-row
					@click="startEditing(row)"
				>
					<RenderTemplate :item="row" :collection="collection" :template="displayTemplate" />
				</component>
			</li>
		</ul>
		<DrawerItem
			:active="!!currentlyEditing"
			:collection="collection"
			:primary-key="currentlyEditing ?? '+'"
			:edits="editsAtStart"
			@input="saveEdits"
			@update:active="cancelEdit"
		/>
	</div>
</template>
