<!-- Ported from directus/app/src/modules/settings/routes/data-model/field-detail/field-detail-advanced/field-detail-advanced-relationship.vue -->
<script setup lang="ts">
// Backoffice: the five tabs under their apps/web names.
import { storeToRefs } from 'pinia';
import { useFieldDetailStore } from '../store/index.ts';
import RelationshipM2a from './RelationshipM2a.vue';
import RelationshipM2m from './RelationshipM2m.vue';
import RelationshipM2o from './RelationshipM2o.vue';
import RelationshipO2m from './RelationshipO2m.vue';
import RelationshipTranslations from './RelationshipTranslations.vue';

const fieldDetailStore = useFieldDetailStore();

const { localType } = storeToRefs(fieldDetailStore);
</script>

<template>
	<RelationshipM2o v-if="localType === 'm2o' || localType === 'file'" />
	<RelationshipO2m v-else-if="localType === 'o2m'" />
	<RelationshipM2m v-else-if="localType === 'm2m' || localType === 'files'" />
	<RelationshipM2a v-else-if="localType === 'm2a'" />
	<RelationshipTranslations v-else-if="localType === 'translations'" />
</template>
