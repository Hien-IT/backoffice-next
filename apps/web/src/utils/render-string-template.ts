// Ported from directus/app/src/utils/render-string-template.ts
// Backoffice: `!`/casts only for the strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
import type { Field } from '@directus/types';
import { get, getFieldsFromTemplate } from '@directus/utils';
import { set } from 'lodash-es';
import { render, renderFn } from 'micromustache';
import { computed, type ComputedRef, type Ref, unref } from 'vue';
import { getDisplay } from '../displays/index.ts';
import { useFieldsStore } from '../stores/fields.ts';

type StringTemplate = {
	fieldsInTemplate: ComputedRef<string[]>;
	displayValue: ComputedRef<string | false>;
};

function resolve(path: string, scope: any) {
	const value = get(scope, path);
	return typeof value === 'object' ? JSON.stringify(value) : value;
}

export function renderStringTemplate(
	template: Ref<string | null> | string,
	item: Record<string, any> | undefined | null | Ref<Record<string, any> | undefined | null>,
): StringTemplate {
	const values = unref(item);

	const templateString = unref(template);

	const fieldsInTemplate = computed(() => getFieldsFromTemplate(templateString));

	const displayValue = computed(() => {
		if (!values || !templateString || !fieldsInTemplate.value) return false;

		try {
			return renderFn(templateString, resolve, values, { propsExist: true });
		} catch {
			return false;
		}
	});

	return { fieldsInTemplate, displayValue };
}

export function renderPlainStringTemplate(template: string, item?: Record<string, any> | null): string | null {
	const fieldsInTemplate = getFieldsFromTemplate(template);

	if (!item || !template || !fieldsInTemplate) return null;

	try {
		return render(template, item, { propsExist: true });
	} catch {
		return null;
	}
}

export function renderDisplayStringTemplate(
	collection: string,
	template: string,
	item: Record<string, any>,
): string | null {
	const fieldsStore = useFieldsStore();

	const fields = getFieldsFromTemplate(template);

	const fieldsUsed: Record<string, Field | null> = {};

	for (const key of fields) {
		set(fieldsUsed, key, fieldsStore.getField(collection, key));
	}

	const parsedItem: Record<string, any> = {};

	for (const key of fields) {
		const value = get(item, key);

		// Backoffice: the display config comes from the registry (research R2) instead of useExtension.
		const display = getDisplay(fieldsUsed[key]?.meta?.display ?? null);

		if (value !== undefined && value !== null) {
			set(
				parsedItem,
				key,
				display?.handler
					? display.handler(value, fieldsUsed[key]?.meta?.display_options ?? {}, {
							interfaceOptions: fieldsUsed[key]?.meta?.options ?? {},
							field: (fieldsUsed[key] ?? undefined) as Field,
							collection: collection,
						})
					: value,
			);
		} else {
			set(parsedItem, key, value);
		}
	}

	return renderPlainStringTemplate(template, parsedItem);
}
