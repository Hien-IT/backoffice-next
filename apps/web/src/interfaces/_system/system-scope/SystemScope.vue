<!-- Ported from directus/app/src/interfaces/_system/system-scope/system-scope.vue -->
<script setup lang="ts">
// Backoffice: VSelect is BoSelect, linked to the form label by the FormField ids (FR-094); BoSelect has no divider
// item, so the current value is simply the first item. VSkeletonLoader is the pulse box of the 013 interfaces. The
// requests go through the SDK; a failed name request opens the error dialog (showUnexpectedError, D-66).
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import BoSelect from '../../../components/BoSelect.vue';
import DrawerCollection from '../../../components/drawers/DrawerCollection.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import { showUnexpectedError } from '../../../composables/use-notices.ts';
import { userName } from '../../../utils/user-name.ts';

const props = defineProps<{
	value: string | null;
}>();

const emit = defineEmits<{
	input: [value: string | null];
}>();

const { t } = useI18n();
const a11y = inject(FORM_FIELD_A11Y, null);

const collection = ref<string | null>(null);
const itemName = ref<string | null>(null);
const loading = ref(false);

const itemInfo = computed(() =>
	props.value?.startsWith('role_') || props.value?.startsWith('user_')
		? (props.value.split('_') as [type: string, id: string])
		: null,
);

watch(() => props.value, loadItemName);

loadItemName();

const options = computed(() => {
	let options: { text: string; value: string }[] = [
		{
			text: t('global') + ': ' + t('all_users'),
			value: 'all',
		},
		{
			text: t('user') + ': ' + t('select'),
			value: 'directus_users',
		},
		{
			text: t('role') + ': ' + t('select'),
			value: 'directus_roles',
		},
	];

	if (itemInfo.value) {
		const [type, id] = itemInfo.value;

		options = [
			{
				text: t(type) + ': ' + (itemName.value || id),
				value: props.value!,
			},
			...options,
		];
	}

	return options;
});

function onSelect(value: string) {
	if (value === 'all') {
		collection.value = null;
		return emit('input', 'all');
	}

	collection.value = value;
}

function onSelectItem(value: (string | number)[] | null) {
	if (collection.value === 'directus_users') return emit('input', 'user_' + value![0]);
	if (collection.value === 'directus_roles') return emit('input', 'role_' + value![0]);
}

async function loadItemName() {
	if (!itemInfo.value) {
		itemName.value = null;
		return;
	}

	loading.value = true;

	const [endpoint, id] = itemInfo.value;

	try {
		if (endpoint === 'role') {
			const result = await sdk.request<{ name: string }>(
				requestEndpoint('/roles/' + id, { params: { fields: ['id', 'name'] } }),
			);

			itemName.value = result.name;
		} else if (endpoint === 'user') {
			const result = await sdk.request<Record<string, any>>(
				requestEndpoint('/users/' + id, { params: { fields: ['id', 'first_name', 'last_name', 'email'] } }),
			);

			itemName.value = userName(result);
		}
	} catch (error) {
		showUnexpectedError(error);
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div>
		<div
			v-if="loading"
			aria-busy="true"
			class="h-11 w-full animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-white/5"
		>
			<span class="sr-only">{{ $t('loading') }}</span>
		</div>
		<BoSelect v-else :id="a11y?.inputId" :model-value="value" :items="options" @update:model-value="onSelect" />
		<DrawerCollection
			v-if="collection !== null"
			:active="collection !== null"
			:collection="collection"
			@update:active="collection = null"
			@input="onSelectItem"
		/>
	</div>
</template>
