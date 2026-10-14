<!-- Ported from directus/app/src/components/v-form/components/validation-nested-groups-list.vue -->
<script setup lang="ts">
// Backoffice: list markers and spacing as classes (disc for "all", square for "any").
export type RenderItem =
	| {
			kind: 'rule';
			text: string;
			fieldName?: string;
	  }
	| {
			kind: 'group';
			logic: 'and' | 'or';
			labelPrefix: string;
			labelSuffix: string;
			children?: RenderItem[];
	  };

defineOptions({ name: 'ValidationNestedGroupsList' });

const props = defineProps<{
	items: RenderItem[];
	depth: number;
	listLogic?: 'and' | 'or' | undefined;
}>();
</script>

<template>
	<ul
		class="m-0 space-y-1"
		:class="[(props.listLogic ?? 'and') === 'and' ? 'list-disc' : 'list-[square]', props.depth === 0 ? 'ps-5' : 'ps-4']"
	>
		<li v-for="(item, idx) in props.items" :key="idx" class="leading-tight">
			<span class="rule">
				<template v-if="item.kind === 'group'">
					<span class="uppercase">{{ item.labelPrefix }}</span>
					{{ item.labelSuffix }}
				</template>
				<template v-else>
					<template v-if="item.fieldName">
						<strong>{{ item.fieldName }}:</strong>
						{{ item.text }}
					</template>
					<template v-else>
						{{ item.text }}
					</template>
				</template>
			</span>
			<ValidationNestedGroupsList
				v-if="item.kind === 'group' && item.children && item.children.length > 0"
				class="mt-1"
				:items="item.children"
				:depth="props.depth + 1"
				:list-logic="item.logic"
			/>
		</li>
	</ul>
</template>
