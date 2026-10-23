// Ported from directus/app/src/utils/save-as-csv.ts
// Backoffice: displays come from the internal registry (`getDisplay`) instead of `useExtension`; the CSV text is built by
// `buildCSV` so tests can compare it with the file the DR app downloads (spec 014 FR-092, T010).
import type { Field, Item } from '@directus/types';
import { Parser } from '@json2csv/plainjs';
import fileSaver from 'file-saver';
import { useAliasFields } from '../composables/use-alias-fields.ts';
import { getDisplay } from '../displays/index.ts';
import { useFieldsStore } from '../stores/fields.ts';

export async function buildCSV(collection: string, fields: string[], items: Item[]): Promise<string> {
	const fieldsStore = useFieldsStore();

	const fieldsUsed: Record<string, Field | null> = {};

	for (const key of fields) {
		fieldsUsed[key] = fieldsStore.getField(collection, key);
	}

	const { getFromAliasedItem } = useAliasFields(fields, collection);

	const parsedItems = [];

	for (const item of items) {
		const parsedItem: Record<string, any> = {};

		for (const key of fields) {
			let name: string;

			const keyParts = key.split('.');

			if (keyParts.length > 1) {
				const names = keyParts.map((fieldKey, index) => {
					const pathPrefix = keyParts.slice(0, index);
					const field = fieldsStore.getField(collection, [...pathPrefix, fieldKey].join('.'));
					return field?.name ?? fieldKey;
				});

				name = names.join(' -> ');
			} else {
				name = fieldsUsed[key]?.name ?? key;
			}

			const value = getFromAliasedItem(item, key);

			const display = getDisplay(fieldsUsed[key]?.meta?.display ?? null);

			if (value !== undefined && value !== null) {
				parsedItem[name] = display?.handler
					? await display.handler(value, fieldsUsed[key]?.meta?.display_options ?? {}, {
							interfaceOptions: fieldsUsed[key]?.meta?.options ?? {},
							// Backoffice: no `field: undefined` key (exactOptionalPropertyTypes); same handler input.
							...(fieldsUsed[key] ? { field: fieldsUsed[key] } : {}),
							collection: collection,
						})
					: value;
			} else {
				parsedItem[name] = value;
			}
		}

		parsedItems.push(parsedItem);
	}

	const parser = new Parser();
	return parser.parse(parsedItems);
}

/**
 * Saves the given collection + items combination as a CSV file
 */
export async function saveAsCSV(collection: string, fields: string[], items: Item[]) {
	const csvContent = await buildCSV(collection, fields, items);

	const now = new Date();

	const dateString = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now
		.getDate()
		.toString()
		.padStart(2, '0')}`;

	fileSaver.saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), `${collection}-${dateString}.csv`);
}
