<!-- Ported from directus/app/src/views/private/components/archive-sidebar-detail.vue -->
<script setup lang="ts">
// Backoffice: one BoSelect instead of the VRadio group (recipe Q-9); Reka Select items cannot have an empty value, so
// "not archived" is the `active` item value and maps back to null.
import { computed, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import BoSelect from '../BoSelect.vue';
import SidebarDetail from './SidebarDetail.vue';

const props = defineProps<{
	collection?: string | undefined;
	archive?: string | null | undefined;
}>();

const { t } = useI18n();

const router = useRouter();

const selectedItem = ref<string | null | undefined>(props.archive);

const items = [
	{ text: t('show_active_items'), value: 'active' },
	{ text: t('show_archived_items'), value: 'archived' },
	{ text: t('show_all_items'), value: 'all' },
];

const active = computed(() => !!unref(selectedItem));

watch(props, () => {
	selectedItem.value = props.archive;
});

watch(selectedItem, () => {
	const url = new URL(unref(router.currentRoute).fullPath, window.location.origin);

	url.searchParams.delete('archived');
	url.searchParams.delete('all');

	const selectedItemValue = unref(selectedItem);

	if (selectedItemValue) {
		url.searchParams.set(selectedItemValue, '');
	}

	router.push(url.pathname + url.search);
});
</script>

<template>
	<SidebarDetail id="archive" icon="archive" :title="$t('archive')" :badge="active">
		<BoSelect
			:model-value="selectedItem || 'active'"
			:label="$t('archive')"
			:items="items"
			@update:model-value="selectedItem = $event === 'active' ? null : $event"
		/>
	</SidebarDetail>
</template>
