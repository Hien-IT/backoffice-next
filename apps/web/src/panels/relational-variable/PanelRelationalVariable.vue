<!-- Ported from directus/app/src/panels/relational-variable/panel-relational-variable.vue -->
<script setup lang="ts">
// Backoffice (spec 018 FR-051, FR-052, FR-055, FR-056): unexpectedError is showUnexpectedError (error dialog); the
// padding is PanelTile's; displayTemplate, filter and limit are optional props since the stored options may lack them
// (Directus declares them required and reads undefined the same way).
import type { Filter } from '@directus/types';
import { computed, ref } from 'vue';
import BoNotice from '../../components/BoNotice.vue';
import DrawerCollection from '../../components/drawers/DrawerCollection.vue';
import { showUnexpectedError } from '../../composables/use-notices.ts';
import { useInsightsStore } from '../../stores/insights.ts';
import MultipleRelation from './MultipleRelation.vue';
import SingleRelation from './SingleRelation.vue';

const props = defineProps<{
	field: string;
	collection: string;
	multiple: boolean;
	displayTemplate?: string | undefined;
	filter?: Filter | undefined;
	limit?: number | undefined;
	dashboard: string;
	showHeader?: boolean;
}>();

defineEmits(['input']);

const insightsStore = useInsightsStore();

const value = computed({
	get(): (string | number)[] | undefined {
		const val = insightsStore.getVariable(props.field) as (string | number)[] | string | number | undefined;
		if (props.multiple) return (val as (string | number)[] | undefined) ?? [];
		return val ? [val as string | number] : undefined;
	},
	set(val: any) {
		const _val = !props.multiple && Array.isArray(val) ? val[0] : val;
		insightsStore.setVariable(props.field, _val);
	},
});

const selectModalOpen = ref(false);

function onSelection(data: (number | string)[] | null) {
	selectModalOpen.value = false;

	if (!Array.isArray(data) || data.length === 0) {
		value.value = [];
		return;
	}

	if (props.multiple) {
		const items = Array.from(new Set(data.concat(value.value ?? [])));

		if (props.limit !== undefined && items.length > props.limit) {
			showUnexpectedError(new Error('More items selected than the allowed limit'));
			value.value = items.slice(0, props.limit);
		} else {
			value.value = items;
		}
	} else {
		value.value = data;
	}
}
</script>

<template>
	<div
		class="relational-variable h-full"
		:class="{ 'show-header': showHeader, 'grid w-full content-center': !multiple }"
	>
		<BoNotice v-if="!collection" type="warning">
			{{ $t('collection_field_not_setup') }}
		</BoNotice>

		<MultipleRelation
			v-else-if="multiple"
			:collection="collection"
			:template="displayTemplate"
			:filter="filter"
			:value="value"
			:limit="limit ?? 5"
			@input="value = $event"
			@select="selectModalOpen = true"
		/>
		<SingleRelation
			v-else
			:collection="collection"
			:template="displayTemplate"
			:filter="filter"
			:value="value"
			@input="value = $event"
			@select="selectModalOpen = true"
		/>

		<!-- Backoffice: `eager` loads the items while the drawer is closed, as Directus (owner 2026-10-18, T002 baseline). -->
		<DrawerCollection
			eager
			:active="selectModalOpen"
			:collection="collection"
			:selection="value ?? []"
			:filter="filter"
			:multiple="multiple"
			@input="onSelection"
			@update:active="selectModalOpen = false"
		/>
	</div>
</template>
