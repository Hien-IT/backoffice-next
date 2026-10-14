// Ported from directus/app/src/stores/fields.ts
// Backoffice: read-only part of the store (hydrate, parse, translate, getters). The write actions (upsertField,
// createField, updateField, updateFields, deleteField) come with the data model screens (feature 015+, D-45); the AI
// tools hook is removed (D-54).
import formatTitle from '@directus/format-title';
import type { Field, FieldRaw, Relation } from '@directus/types';
import { isEmpty, isNil, merge, orderBy } from 'lodash-es';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';
import { i18n } from '../lang/index.ts';
import { getLiteralInterpolatedTranslation } from '../utils/get-literal-interpolated-translation.ts';
import { translate } from '../utils/translate-object-values.ts';
import { useRelationsStore } from './relations.ts';

type HydrateOptions = {
	/**
	 * Allow disabling field translation on hydrate. Used in global app hydration to account for
	 * user's custom locale instead of the default en-US locale.
	 */
	skipTranslation?: boolean;
};

// Backoffice: directus/app/src/utils/translate-literal.ts, inlined (translate-object-values.ts keeps its own copy).
function translateLiteral(literal: any): string {
	let translated = literal;

	if (typeof literal === 'string' && literal.startsWith('$t:')) translated = i18n.global.t(literal.replace('$t:', ''));

	return translated;
}

/**
 * directus_files is a special case. For it to play nice with interfaces/layouts/displays, we need
 * to treat the actual image thumbnail as a separate available field, instead of part of the regular
 * item (normally all file related info is nested within a separate column). This allows layouts to
 * render out files as it if were a "normal" collection, where the actual file is a fake m2o to
 * itself.
 */
// Backoffice: cast like Directus' object, which has no meta.searchable (exactOptionalPropertyTypes here).
const fakeFilesField = {
	collection: 'directus_files',
	field: '$thumbnail',
	schema: null,
	name: '$thumbnail',
	type: 'integer',
	meta: {
		id: -1,
		collection: 'directus_files',
		field: '$thumbnail',
		sort: null,
		special: null,
		interface: null,
		options: null,
		display: 'file',
		display_options: null,
		hidden: false,
		translations: null,
		readonly: true,
		width: 'full',
		group: null,
		note: null,
		required: false,
		conditions: null,
		validation: null,
		validation_message: null,
	},
} as Field;

export const useFieldsStore = defineStore('fieldsStore', () => {
	const fields = ref<Field[]>([]);

	return {
		fields,
		hydrate,
		dehydrate,
		parseField,
		translateFields,
		getPrimaryKeyFieldForCollection,
		getFieldsForCollection,
		getFieldsForCollectionAlphabetical,
		getFieldsForCollectionSorted,
		getField,
		getFieldGroupChildren,
	};

	async function hydrate(options?: HydrateOptions) {
		const fieldsRaw = await sdk.request(requestEndpoint<FieldRaw[]>('/fields', { method: 'GET' }));

		fields.value = [...fieldsRaw.map(parseField), fakeFilesField];
		if (options?.skipTranslation !== true) translateFields();
	}

	async function dehydrate() {
		fields.value = [];
	}

	function parseField(field: FieldRaw): Field {
		let name = formatTitle(field.field);

		const localesToKeep =
			field.meta && !isNil(field.meta.translations) && Array.isArray(field.meta.translations)
				? field.meta.translations.map((translation) => translation.language)
				: [];

		for (const locale of i18n.global.availableLocales) {
			if (
				i18n.global.te(`fields.${field.collection}.${field.field}`, locale) &&
				!localesToKeep.includes(locale) &&
				!field.meta?.system
			) {
				i18n.global.mergeLocaleMessage(locale, { fields: { [field.collection]: { [field.field]: undefined } } });
			}
		}

		if (field.meta && Array.isArray(field.meta.translations)) {
			for (const { language, translation } of field.meta.translations) {
				i18n.global.mergeLocaleMessage(language, {
					...(translation
						? {
								fields: {
									[field.collection]: {
										[field.field]: getLiteralInterpolatedTranslation(translation),
									},
								},
							}
						: {}),
				});
			}
		}

		if (i18n.global.te(`fields.${field.collection}.${field.field}`)) {
			name = i18n.global.t(`fields.${field.collection}.${field.field}`);
		}

		return {
			...field,
			name,
		};
	}

	function translateFields() {
		fields.value = fields.value.map((field) => {
			const translations: Partial<Field> = {};

			if (i18n.global.te(`fields.${field.collection}.${field.field}`)) {
				translations.name = i18n.global.t(`fields.${field.collection}.${field.field}`);
			}

			if (field.meta) {
				translations.meta = {} as Field['meta'];
			}

			if (field.meta?.note) translations.meta!.note = translateLiteral(field.meta.note);
			if (field.meta?.options) translations.meta!.options = translate(field.meta.options);
			if (field.meta?.display_options) translations.meta!.display_options = translate(field.meta.display_options);

			if (field.meta?.validation_message) {
				translations.meta!.validation_message = translateLiteral(field.meta.validation_message);
			}

			if (!isEmpty(translations)) {
				return merge({}, field, translations);
			}

			return field;
		});
	}

	function getPrimaryKeyFieldForCollection(collection: string): Field | null {
		const primaryKeyField = fields.value.find(
			(field) => field.collection === collection && field.schema?.is_primary_key === true,
		);

		return primaryKeyField ?? null;
	}

	function getFieldsForCollection(collection: string): Field[] {
		return orderBy(
			fields.value.filter((field) => field.collection === collection),
			[(field) => field.meta?.system === true, (field) => (field.meta?.sort ? Number(field.meta?.sort) : null)],
			['desc', 'asc'],
		);
	}

	function getFieldsForCollectionAlphabetical(collection: string): Field[] {
		return getFieldsForCollection(collection).sort((a: Field, b: Field) => {
			if (a.field < b.field) return -1;
			else if (a.field > b.field) return 1;
			else return 1;
		});
	}

	/**
	 * Retrieve sorted fields including groups. This is necessary because
	 * fields inside groups starts their sort number from 1 to N again.
	 */
	function getFieldsForCollectionSorted(collection: string): Field[] {
		const fieldsSorted = orderBy(
			fields.value.filter((field) => field.collection === collection),
			'meta.sort',
		);

		const nonGroupFields = fieldsSorted.filter((field: Field) => !field.meta?.group);

		for (const [index, field] of nonGroupFields.entries()) {
			const groupFields = fieldsSorted.filter((groupField: Field) => groupField.meta?.group === field.field);

			if (groupFields.length) {
				nonGroupFields.splice(index + 1, 0, ...orderBy(groupFields, 'meta.sort'));
			}
		}

		return nonGroupFields;
	}

	/**
	 * Retrieve field info for a field or a related field
	 */
	function getField(collection: string, fieldKey: string): Field | null {
		if (fieldKey.includes('.')) {
			return getRelationalField(collection, fieldKey) || null;
		} else {
			return fields.value.find((field) => field.collection === collection && field.field === fieldKey) || null;
		}
	}

	/**
	 * Retrieve nested fields for a given group field
	 */
	function getFieldGroupChildren(collection: string, fieldKey: string): Field[] | null {
		return fields.value.filter((field) => field.collection === collection && field.meta?.group === fieldKey) || null;
	}

	/**
	 * Retrieve field info for a (deeply) nested field
	 * Recursively searches through the relationships to find the field info that matches the
	 * dot notation.
	 */
	function getRelationalField(collection: string, fields: string): Field | null | false {
		const relationsStore = useRelationsStore();
		const [field, ...path] = fields.split('.') as [string] & string[];

		if (field.includes(':')) {
			const [_, collection] = field.split(':') as [string, string];
			return getField(collection, path.join('.'));
		}

		const relations = relationsStore.getRelationsForField(collection, field);

		const relation = relations?.find((relation: Relation) => {
			return relation.field === field || relation.meta?.one_field === field;
		});

		if (relation === undefined) return false;

		const relatedCollection = relation.field === field ? relation.related_collection : relation.collection;

		if (relatedCollection === null) return false;

		const relatedField = path.join('.');
		return getField(relatedCollection, relatedField);
	}
});
