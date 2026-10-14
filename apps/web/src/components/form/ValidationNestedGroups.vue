<!-- Ported from directus/app/src/components/v-form/components/validation-nested-groups.vue -->
<script setup lang="ts">
// Backoffice: validation-nested-groups-list.vue (the recursive list) is the `ValidationNestedGroupsList` part of this
// file; classes instead of the scoped styles.
import type { Field } from '@directus/types';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ValidationNode } from './utils/format-validation-structure.ts';
import { formatValidationRule } from './utils/format-validation-structure.ts';
import ValidationNestedGroupsList, { type RenderItem } from './ValidationNestedGroupsList.vue';

interface Props {
	node: ValidationNode;
	depth?: number | undefined;
	parentField?: string | undefined;
	fields?: Field[] | undefined;
}

const props = withDefaults(defineProps<Props>(), {
	depth: 0,
	parentField: undefined,
	fields: undefined,
});

const { t } = useI18n();

function groupLabel(type: 'and' | 'or') {
	return {
		prefix: type === 'and' ? t('interfaces.filter.all') : t('interfaces.filter.any'),
		suffix: t('interfaces.filter.of_the_following'),
	};
}

function renderRule(node: ValidationNode): { text: string; fieldName?: string } {
	const ruleText = formatValidationRule(node, t);

	if (node.type === 'rule' && node.field && props.parentField && node.field !== props.parentField && props.fields) {
		const field = props.fields.find((f) => f.field === node.field);
		const fieldName = field?.name ?? node.field;
		return { text: ruleText, fieldName };
	}

	return { text: ruleText };
}

function buildItems(node: ValidationNode): RenderItem[] {
	if (node.type === 'rule') {
		const rule = renderRule(node);

		return [
			{
				kind: 'rule',
				text: rule.text,
				...(rule.fieldName ? { fieldName: rule.fieldName } : {}),
			},
		];
	}

	if ((node.type !== 'and' && node.type !== 'or') || !node.children?.length) return [];

	if (node.children.length === 1 && node.children[0]?.type === node.type) {
		return buildItems(node.children[0]);
	}

	const label = groupLabel(node.type);

	return [
		{
			kind: 'group',
			labelPrefix: label.prefix,
			labelSuffix: label.suffix,
			logic: node.type,
			children: node.children.flatMap((child) => buildItems(child)),
		},
	];
}

const items = computed(() => {
	return buildItems(props.node);
});
</script>

<template>
	<div class="mt-1 text-error-700 dark:text-error-400">
		<ValidationNestedGroupsList
			:items="items"
			:depth="props.depth"
			:list-logic="props.node.type === 'and' || props.node.type === 'or' ? props.node.type : undefined"
		/>
	</div>
</template>
