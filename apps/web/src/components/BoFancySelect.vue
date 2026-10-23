<!-- Ported from directus/app/src/components/v-fancy-select.vue -->
<script setup lang="ts">
// Backoffice (recipe Q-22, field drawer Interface / Display tabs): a list of option buttons (`aria-pressed`) with an
// icon, a name and a description; once one is chosen only it stays, with a `cancel` button to choose again. Dividers
// between groups. No TransitionGroup. Feature 018 (recipe Q-37): `layout="grid"` is the type grid of the DR panel
// drawer (`panel-configuration.vue`): every item stays (not subdued as in DR: faded text fails 4.5:1, FR-106),
// pressing the chosen one clears it.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';

export type FancySelectItem = (
	| {
			icon: string;
			value?: string | number;
			text: string;
			description?: string | undefined;
			iconRight?: string;
	  }
	| { divider: true }
) &
	Record<string, any>;

interface Props {
	/** The list of possible items to display */
	items: FancySelectItem[];
	/** Used to model the current selected item */
	modelValue?: string | number | null;
	/** Disable selecting / deselecting a value */
	disabled?: boolean;
	/** `grid`: cards in 2 columns at 768 px, 3 from lg, all items kept (018) */
	layout?: 'list' | 'grid';
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: null,
	disabled: false,
	layout: 'list',
});

const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>();

const { t } = useI18n();

const visibleItems = computed(() => {
	if (props.layout === 'grid') return props.items.filter((item) => item['divider'] !== true);
	if (props.modelValue === null) return props.items;

	return props.items.filter((item) => item['value'] === props.modelValue);
});

function toggle(item: Record<string, any>) {
	if (props.disabled === true) return;
	if (props.modelValue === item['value']) emit('update:modelValue', null);
	else emit('update:modelValue', item['value']);
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
</script>

<template>
	<div v-if="layout === 'grid'" class="grid grid-cols-2 gap-3 lg:grid-cols-3">
		<button
			v-for="item in visibleItems"
			:key="item['value']"
			type="button"
			class="flex flex-col items-start gap-2 rounded-xl border p-4 text-start disabled:cursor-not-allowed"
			:class="[
				FOCUS,
				item['value'] === modelValue
					? 'border-brand-500 bg-brand-50 dark:bg-brand-500/[0.12]'
					: 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700',
			]"
			:disabled="disabled"
			:aria-pressed="item['value'] === modelValue"
			@click="toggle(item)"
		>
			<BoIcon :name="item['icon']" size="lg" class="text-brand-500 dark:text-brand-400" />
			<span class="block w-full truncate text-theme-sm font-semibold text-gray-800 dark:text-white/90">
				{{ item['text'] }}
			</span>
			<span v-if="item['description']" class="block text-theme-xs text-gray-600 dark:text-gray-400">
				{{ item['description'] }}
			</span>
		</button>
	</div>

	<div v-else class="flex flex-col gap-2">
		<template v-for="(item, index) in visibleItems" :key="item['value'] ?? `divider-${index}`">
			<hr v-if="item['divider'] === true" class="my-2 border-gray-200 dark:border-gray-800" />
			<div
				v-else
				class="flex items-center gap-3 rounded-xl border px-3 py-2.5"
				:class="
					item['value'] === modelValue
						? 'border-brand-500 bg-brand-50 dark:bg-brand-500/[0.12]'
						: 'border-gray-200 dark:border-gray-800'
				"
			>
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start disabled:cursor-not-allowed"
					:class="FOCUS"
					:disabled="disabled"
					:aria-pressed="item['value'] === modelValue"
					@click="toggle(item)"
				>
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300"
					>
						<BoIcon :name="item['icon']" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
							{{ item['text'] }}
						</span>
						<span class="block truncate text-theme-xs text-gray-600 dark:text-gray-400">{{ item['description'] }}</span>
					</span>
					<BoIcon
						v-if="item['iconRight'] && modelValue !== item['value']"
						:name="item['iconRight']"
						size="sm"
						class="text-brand-500"
					/>
				</button>
				<button
					v-if="modelValue === item['value'] && disabled === false"
					type="button"
					class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
					:class="FOCUS"
					:aria-label="t('deselect')"
					:title="t('deselect')"
					@click="toggle(item)"
				>
					<BoIcon name="cancel" size="sm" />
				</button>
			</div>
		</template>
	</div>
</template>
