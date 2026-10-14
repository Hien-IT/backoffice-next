<!-- Ported from directus/app/src/views/private/components/render-template.vue -->
<script setup lang="ts">
// Backoffice: displays come from the registry (getDisplay); translate-literal.ts is inlined; styles as Tailwind
// classes (one line, cut with an ellipsis, parts centered vertically).
import type { Field } from '@directus/types';
import { get } from '@directus/utils';
import { computed } from 'vue';
import { getDisplay } from '../../displays/index.ts';
import { i18n } from '../../lang/index.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { getDefaultDisplayForType } from '../../utils/get-default-display-for-type.ts';
import ErrorBoundary from './ErrorBoundary.vue';
import ValueNull from './ValueNull.vue';

const props = withDefaults(
	defineProps<{
		template: string;
		collection?: string | undefined;
		fields?: Field[];
		item?: Record<string, any>;
		direction?: string | undefined;
	}>(),
	{
		fields: () => [],
		item: () => ({}),
	},
);

type DisplayPart = {
	component: string;
	options: Record<string, any> | null | undefined;
	value: any;
	interface: string | null | undefined;
	interfaceOptions: Record<string, any> | null | undefined;
	type: string;
	collection: string;
	field: string;
};

const fieldsStore = useFieldsStore();
const relationsStore = useRelationsStore();

const regex = /({{.*?}})/g;

// directus/app/src/utils/translate-literal.ts
function translate(literal: any): string {
	let translated = literal;

	if (typeof literal === 'string' && literal.startsWith('$t:')) translated = i18n.global.t(literal.replace('$t:', ''));

	return translated;
}

const getNestedValues = (data: any, path: string) => {
	const pathParts = path.split('.');
	let currentData = data;

	pathParts.filter(partWithoutDollarPrefix).forEach((part) => {
		if (props.collection && partIsM2AItem(part)) {
			const [itemField = '', anyCollection = ''] = part.split(':');
			if (!anyCollection || anyCollection !== getM2AJunctionCollectionField(props.collection, itemField)) return;
		}

		currentData = get(currentData, part) ?? null;
	});

	return Array.isArray(currentData) ? currentData : [currentData];

	function partWithoutDollarPrefix(part: string) {
		// For example `$thumbnail`
		return !part.startsWith('$');
	}

	function partIsM2AItem(part: string) {
		// For example `item:posts`
		return part.includes(':');
	}

	function getM2AJunctionCollectionField(collection: string, itemField: string) {
		const relations = relationsStore.getRelationsForField(collection, itemField);

		const collectionField =
			relations.find((relation) => relation.meta?.one_collection_field)?.meta?.one_collection_field ?? '';

		return currentData[collectionField];
	}
};

const parts = computed(() =>
	props.template
		.split(regex)
		.filter((p) => p)
		.map((part): (DisplayPart | string | null | unknown)[] => {
			if (part.startsWith('{{') === false) return [part];

			const fieldKey = part.replace(/{{/g, '').replace(/}}/g, '').trim();

			// Try getting the value from the item
			let value = getNestedValues(props.item, fieldKey);

			let field: Field | null = props.fields?.find((field) => field.field === fieldKey) ?? null;

			if (props.collection) {
				field = fieldsStore.getField(props.collection, fieldKey);
			}

			if (!field) return value;

			if (field?.meta?.interface === 'system-input-translated-string') {
				value = value.map(translate);
			}

			const component = field?.meta?.display || getDefaultDisplayForType(field.type);
			const options = field?.meta?.display_options;

			// No need to render the empty display overhead in this case
			if (component === 'raw') return value;

			const displayInfo = getDisplay(component) ?? null;

			if (!displayInfo) return value;

			if (
				component &&
				['related-values', 'formatted-value', 'formatted-json-value', 'translations'].includes(component)
			) {
				// These displays natively support rendering arrays of values
				return [
					{
						component,
						options,
						value,
						interface: field.meta?.interface,
						interfaceOptions: field.meta?.options,
						type: field.type,
						collection: field.collection,
						field: field.field,
					},
				];
			} else if (component) {
				return value.map((v) => {
					return {
						component: component,
						options: field.meta?.display_options,
						value: v,
						interface: field.meta?.interface,
						interfaceOptions: field.meta?.options,
						type: field.type,
						collection: field.collection,
						field: field.field,
					};
				});
			} else {
				return value;
			}
		})
		.map((p) => p ?? null),
);

function isDisplayPart(subPart: unknown): subPart is DisplayPart {
	return typeof subPart === 'object' && subPart !== null && 'component' in subPart;
}

function isNullPart(subPart: unknown) {
	return subPart === null || (typeof subPart === 'object' && (subPart as { value?: unknown }).value === null);
}
</script>

<template>
	<div class="relative h-full max-w-full truncate pe-[0.4375rem] *:align-middle">
		<span class="inline-block h-full w-0 align-middle" />
		<template v-for="(part, index) in parts" :key="index">
			<template v-for="(subPart, subIndex) in part" :key="subIndex">
				<ErrorBoundary>
					<ValueNull v-if="isNullPart(subPart)" />
					<template v-else-if="isDisplayPart(subPart)">
						<component
							:is="getDisplay(subPart.component)!.component"
							v-bind="subPart.options ?? {}"
							:value="subPart.value"
							:interface="subPart.interface"
							:interface-options="subPart.interfaceOptions"
							:type="subPart.type"
							:collection="subPart.collection"
							:field="subPart.field"
						/>
						<span v-if="subIndex < part.length - 1">&nbsp;</span>
					</template>
					<span v-else-if="typeof subPart === 'string'" :dir="direction">{{ translate(subPart) }}</span>
					<span v-else>{{ subPart }}</span>
					<template #fallback>
						<span>{{ (subPart as DisplayPart | null)?.value || subPart }}</span>
					</template>
				</ErrorBoundary>
			</template>
		</template>
	</div>
</template>
