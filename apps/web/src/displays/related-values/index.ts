// Ported from directus/app/src/displays/related-values/index.ts
import type { Field } from '@directus/types';
import { getFieldsFromTemplate } from '@directus/utils';
import { get, set } from 'lodash-es';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { adjustFieldsForDisplays } from '../../utils/adjust-fields-for-displays.ts';
import { getRelatedCollection } from '../../utils/get-related-collection.ts';
import { renderPlainStringTemplate } from '../../utils/render-string-template.ts';
import { getDisplay } from '../index.ts';
import { defineDisplay } from '../types.ts';
import DisplayRelatedValues from './DisplayRelatedValues.vue';

// Backoffice: RELATIONAL_TYPES of @directus/constants (not a dependency of apps/web).
const RELATIONAL_TYPES = ['file', 'files', 'm2o', 'o2m', 'm2m', 'm2a', 'translations'] as const;

type Options = {
	template: string;
};

export default defineDisplay({
	id: 'related-values',
	name: '$t:displays.related-values.related-values',
	description: '$t:displays.related-values.description',
	icon: 'settings_ethernet',
	component: DisplayRelatedValues,
	options: ({ editing, relations }) => {
		const relatedCollection = relations.o2m?.collection ?? relations.m2o?.related_collection;

		const displayTemplateMeta: Partial<Field['meta']> =
			editing === '+'
				? {
						interface: 'presentation-notice',
						options: {
							text: '$t:displays.related-values.display_template_configure_notice',
						},
						width: 'full',
					}
				: {
						interface: 'system-display-template',
						options: {
							collectionName: relatedCollection,
						},
						width: 'full',
					};

		return [
			{
				field: 'template',
				name: '$t:display_template',
				meta: displayTemplateMeta,
			},
		];
	},
	handler: (value, options, { collection, field }) => {
		if (!field || !collection) return value;

		const relatedCollections = getRelatedCollection(collection, field.field);

		if (!relatedCollections) return value;

		const fieldsStore = useFieldsStore();

		const fieldKeys = getFieldsFromTemplate(options['template']);

		const fields = fieldKeys.map((fieldKey) => {
			return {
				key: fieldKey,
				field: fieldsStore.getField(
					relatedCollections.junctionCollection ?? relatedCollections.relatedCollection,
					fieldKey,
				),
			};
		});

		const stringValues: Record<string, string> = {};

		for (const { key, field } of fields) {
			const fieldValue = get(value, key);

			if (fieldValue === null || fieldValue === undefined) continue;

			if (!field?.meta?.display) {
				set(stringValues, key, fieldValue);
				continue;
			}

			// Backoffice: the display config comes from the registry (research R2) instead of useExtension.
			const display = getDisplay(field.meta.display);

			const stringValue = display?.handler
				? display.handler(fieldValue, field?.meta?.display_options ?? {}, {
						interfaceOptions: field?.meta?.options ?? {},
						field: field ?? undefined,
						collection: collection,
					})
				: fieldValue;

			set(stringValues, key, stringValue);
		}

		return renderPlainStringTemplate(options['template'], stringValues);
	},
	types: ['alias', 'string', 'uuid', 'integer', 'bigInteger', 'json'],
	localTypes: [...RELATIONAL_TYPES],
	fields: (options: Options | null, { field, collection }) => {
		const relatedCollectionData = getRelatedCollection(collection, field);

		if (!relatedCollectionData) return [];

		const fieldsStore = useFieldsStore();

		const { junctionCollection, relatedCollection, path } = relatedCollectionData;

		const primaryKeyField = fieldsStore.getPrimaryKeyFieldForCollection(relatedCollection);

		const fields = options?.template
			? adjustFieldsForDisplays(getFieldsFromTemplate(options.template), junctionCollection ?? relatedCollection)
			: [];

		if (primaryKeyField) {
			const primaryKeyFieldValue = path ? [...path, primaryKeyField.field].join('.') : primaryKeyField.field;

			if (!fields.includes(primaryKeyFieldValue)) {
				fields.push(primaryKeyFieldValue);
			}
		}

		const fieldStoreField = fieldsStore.getField(collection, field);

		if (fieldStoreField?.meta?.special?.includes('m2a')) {
			const relationsStore = useRelationsStore();
			const relations = relationsStore.getRelationsForField(collection, field);

			const collectionField = relations.find((relation) => relation.meta?.one_collection_field)?.meta
				?.one_collection_field;

			if (collectionField && !fields.find((field) => field === collectionField)) {
				fields.push(collectionField);
			}
		}

		return fields;
	},
});
