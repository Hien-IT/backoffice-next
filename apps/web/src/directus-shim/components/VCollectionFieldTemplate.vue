<!-- Ported from directus/app/src/components/v-collection-field-template.vue -->
<script setup lang="ts">
// Backoffice (spec 020, data-model §7): VFieldTemplate on the field tree of `collection` (useFieldTree), a notice
// without a collection. The attributes (aria-label) go to the field template's textbox.
import { toRefs } from 'vue';
import BoNotice from '../../components/BoNotice.vue';
import { useFieldTree } from '../../composables/use-field-tree.ts';
import VFieldTemplate from './VFieldTemplate.vue';

defineOptions({ inheritAttrs: false });

const value = defineModel<string | null>();

const props = defineProps<{
	placeholder?: string | null;
	disabled?: boolean;
	collection: string | null;
}>();

const { collection } = toRefs(props);

const { treeList, loadFieldRelations } = useFieldTree(collection);
</script>

<template>
	<div class="system-display-template">
		<BoNotice v-if="collection === null">
			{{ $t('interfaces.system-display-template.select_a_collection') }}
		</BoNotice>
		<VFieldTemplate
			v-else
			v-bind="$attrs"
			v-model="value"
			:tree="treeList"
			:disabled="disabled"
			:placeholder="placeholder"
			:load-path-level="loadFieldRelations"
		/>
	</div>
</template>
