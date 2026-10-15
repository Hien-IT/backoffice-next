<!-- Ported from directus/app/src/interfaces/_system/system-theme-overrides/SystemThemeOverridesGroup.vue -->
<script setup lang="ts">
// Backoffice: the group toggle is a disclosure button (`aria-expanded`, `aria-controls`) with the FOCUS recipe; the
// expand transition is left out. A dot marks a group with a stored value.
import { isPlainObject } from 'lodash-es';
import { computed, ref, useId } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import SystemThemeOverridesRule from './SystemThemeOverridesRule.vue';
import type { SetValueFn } from './types.ts';

defineOptions({
	name: 'SystemThemeOverridesGroup',
});

const props = defineProps<{
	rules: Record<string, unknown>;
	group?: string | undefined;
	root?: boolean;
	value: Record<string, unknown> | undefined;
	path: string[];
	set: SetValueFn;
}>();

const collapsed = ref(true);
const contentsId = useId();

const rulesGrouped = computed(() => {
	if (!props.root) return props.rules;

	return {
		$root: Object.fromEntries(Object.entries(props.rules).filter(([_key, value]) => isPlainObject(value) === false)),
		...Object.fromEntries(Object.entries(props.rules).filter(([_key, value]) => isPlainObject(value))),
	};
});

// A rule leaf (or its stored value): a string or a number, cast as in the Directus template.
const leaf = (value: unknown) => value as string | number;

const hasValue = computed(() => {
	return !!props.value && (isPlainObject(props.value) ? Object.keys(props.value).length > 0 : true);
});
</script>

<template>
	<div data-group :data-root="root || undefined">
		<button
			v-if="!root"
			type="button"
			class="relative -ms-2 flex w-[calc(100%+1rem)] items-center gap-1 rounded-lg px-2 py-0.5 text-start font-mono text-theme-sm text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:bg-white/5 dark:focus-visible:outline-brand-400"
			:aria-expanded="!collapsed"
			:aria-controls="contentsId"
			:data-has-value="hasValue || undefined"
			@click="collapsed = !collapsed"
		>
			<span
				v-if="hasValue"
				class="absolute start-0 top-1/2 size-1 -translate-y-1/2 rounded-full bg-gray-500 dark:bg-gray-400"
				aria-hidden="true"
			/>
			<span>{{ group ?? 'globals' }}</span>
			<BoIcon
				name="expand_more"
				size="sm"
				class="transition-transform motion-reduce:transition-none"
				:class="{ '-rotate-90': collapsed }"
			/>
		</button>

		<div
			v-if="root || !collapsed"
			:id="contentsId"
			:class="{ 'border-s border-gray-200 ps-[2ch] dark:border-gray-800': !root }"
		>
			<template v-for="(ruleValue, ruleKey) in rulesGrouped" :key="ruleKey">
				<SystemThemeOverridesGroup
					v-if="isPlainObject(ruleValue)"
					:group="ruleKey === '$root' ? undefined : ruleKey"
					:rules="ruleValue as Record<string, unknown>"
					:value="ruleKey === '$root' ? value : (value?.[ruleKey] as Record<string, unknown> | undefined)"
					:set="set"
					:path="ruleKey === '$root' ? path : [...path, ruleKey]"
				/>

				<SystemThemeOverridesRule
					v-else
					:rule="ruleKey"
					type="color"
					:set="set"
					:default-value="leaf(ruleValue)"
					:value="leaf(value?.[ruleKey])"
					:path="[...path, ruleKey]"
				/>
			</template>
		</div>
	</div>
</template>
