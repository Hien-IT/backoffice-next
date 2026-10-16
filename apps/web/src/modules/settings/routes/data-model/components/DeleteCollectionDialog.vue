<!-- Ported from directus/app/src/modules/settings/routes/data-model/collections/components/collection-options.vue (delete dialog) -->
<script setup lang="ts">
// Backoffice: the delete dialog of the collection menu as its own BoDialog (Cancel first and focused, recipe Q-27). The
// fields of other collections that point at this one are deleted first, as Directus does (a2o relations are ignored on
// purpose). Deleting a folder moves its children to the root (the API sets their group to null). The stores show
// errors in the error dialog (D-66).
import { computed, ref } from 'vue';
import BoButton from '../../../../../components/BoButton.vue';
import BoDialog from '../../../../../components/BoDialog.vue';
import BoNotice from '../../../../../components/BoNotice.vue';
import { type Collection, useCollectionsStore } from '../../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../../stores/relations.ts';

const props = defineProps<{ collection: Collection }>();
const open = defineModel<boolean>('open', { default: false });

const collectionsStore = useCollectionsStore();
const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const peerDependencies = computed(() =>
	relationsStore.relations
		.filter(
			(relation) =>
				relation.meta?.one_collection === props.collection.collection &&
				relation.meta?.many_collection &&
				relation.meta?.many_field,
		)
		.map((relation) => ({ collection: relation.meta!.many_collection!, field: relation.meta!.many_field! })),
);

const deleting = ref(false);

async function deleteCollection() {
	if (deleting.value) return;

	deleting.value = true;

	try {
		for (const dependency of peerDependencies.value) {
			await fieldsStore.deleteField(dependency.collection, dependency.field);
		}

		await collectionsStore.deleteCollection(props.collection.collection);
		open.value = false;
	} finally {
		deleting.value = false;
	}
}
</script>

<template>
	<BoDialog
		v-model:open="open"
		:title="
			collection.schema
				? $t('delete_collection_are_you_sure', { collection: collection.collection })
				: $t('delete_folder_are_you_sure', { folder: collection.collection })
		"
	>
		<BoNotice v-if="peerDependencies.length > 0" type="danger">
			{{ $t('delete_collection_peer_dependencies') }}
			<ul class="mt-2 list-disc ps-5">
				<li v-for="dependency in peerDependencies" :key="`${dependency.collection}.${dependency.field}`">
					{{ dependency.field }} ({{ dependency.collection }})
				</li>
			</ul>
		</BoNotice>

		<template #actions>
			<BoButton variant="secondary" :disabled="deleting" autofocus @click="open = false">{{ $t('cancel') }}</BoButton>
			<BoButton variant="danger" :loading="deleting" @click="deleteCollection">
				{{ collection.schema ? $t('delete_collection') : $t('delete_folder') }}
			</BoButton>
		</template>
	</BoDialog>
</template>
