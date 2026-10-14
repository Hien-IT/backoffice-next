// Ported from directus/app/src/composables/use-relation-m2o.ts
// Backoffice: `as string` on related_collection for the strict null checks of @directus/tsconfig.
import type { Field, Relation } from '@directus/types';
import { computed, type Ref } from 'vue';
import { type Collection, useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';

export type RelationM2O = {
	relation: Relation;
	relatedCollection: Collection;
	relatedPrimaryKeyField: Field;
	type: 'm2o';
};

/*
One                  Many: relatedCollection
┌──────────┐         ┌───────────────────┐
│id        │    ┌────┤id: relatedPKField │
│many_id   │◄───┘    │                   │
└──────────┘         └───────────────────┘
 */

export function useRelationM2O(collection: Ref<string>, field: Ref<string>) {
	const relationsStore = useRelationsStore();
	const collectionsStore = useCollectionsStore();
	const fieldsStore = useFieldsStore();

	const relationInfo = computed<RelationM2O | undefined>(() => {
		const relations = relationsStore.getRelationsForField(collection.value, field.value);

		if (relations.length === 0) return undefined;

		const relation = relations[0] as Relation;

		return {
			relation,
			relatedCollection: collectionsStore.getCollection(relation.related_collection as string),
			relatedPrimaryKeyField: fieldsStore.getPrimaryKeyFieldForCollection(relation.related_collection as string),
			type: 'm2o',
		} as RelationM2O;
	});

	return { relationInfo };
}
