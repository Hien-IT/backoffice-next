<script setup lang="ts">
import {
	ComboboxAnchor,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxPortal,
	ComboboxRoot,
	ComboboxTrigger,
	ComboboxViewport,
} from 'reka-ui';
import { get } from 'lodash-es';
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import BoIcon from './BoIcon.vue';

export type ComboboxItemOption = { text: string; value: string | number; [key: string]: unknown };

const {
	modelValue = null,
	items,
	allowOther = false,
	itemIcon = null,
	itemColor = null,
	ignoreFilter = false,
	loading = false,
	disabled = false,
	invalid = false,
	error,
	hint,
	id: idProp,
	ariaDescribedby,
	shortMenu = false,
} = defineProps<{
	modelValue?: string | number | null;
	items: ComboboxItemOption[];
	/** Offer the typed text as a value when it matches no item (Directus allowOther). */
	allowOther?: boolean;
	/** Item keys of an icon name and a color (Directus v-select itemIcon / itemColor): shown before the item text when
	 * allowOther is off, and the selected item's icon or color dot is the default prepend. */
	itemIcon?: string | null;
	itemColor?: string | null;
	/** Items come filtered from the caller (remote search via `update:search`), so no local filtering. */
	ignoreFilter?: boolean;
	loading?: boolean;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	hint?: string;
	error?: string;
	id?: string | undefined;
	/** Form linking on the input (FormField ids), merged with the hint and error ids. */
	ariaLabelledby?: string | undefined;
	ariaDescribedby?: string | undefined;
	/** Menu at most 30vh high (Directus v-select without `menuFullHeight`); the room left otherwise. */
	shortMenu?: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: string | number];
	/** The typed text, for callers that load items from an API. */
	'update:search': [value: string];
}>();

const { t } = useI18n();

const id = idProp ?? useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;
const describedBy = computed(
	() => [ariaDescribedby, hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined,
);

const search = ref('');

const otherText = computed(() => {
	const text = search.value.trim();
	if (!allowOther || !text) return null;
	const lower = text.toLowerCase();
	return items.some((item) => item.text.toLowerCase() === lower || String(item.value).toLowerCase() === lower)
		? null
		: text;
});

const iconOf = (item: ComboboxItemOption | undefined): string | null =>
	(item && itemIcon && (get(item, itemIcon) as string | null)) || null;
const colorOf = (item: ComboboxItemOption | undefined): string | null =>
	(item && itemColor && (get(item, itemColor) as string | null)) || null;

const selectedItem = computed(() => items.find((item) => item.value === modelValue));
const selectedIcon = computed(() => iconOf(selectedItem.value));
const selectedColor = computed(() => colorOf(selectedItem.value));

function displayValue(value: unknown) {
	if (value === null || value === undefined) return '';
	return items.find((item) => item.value === value)?.text ?? String(value);
}

function onSearch(value: string) {
	search.value = value;
	emit('update:search', value);
}

const FIELD =
	'h-11 w-full rounded-lg border bg-transparent py-2.5 pe-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-500 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-500 disabled:placeholder:text-gray-300 dark:disabled:border-gray-800 dark:disabled:bg-white/[0.03] dark:disabled:placeholder:text-white/15';
const FIELD_VALID =
	'border-gray-500 focus:border-brand-500 focus:ring-brand-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400 dark:border-gray-500 dark:focus:border-brand-400';
const FIELD_INVALID =
	'border-error-600 focus:border-error-600 focus:ring-error-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error-600 dark:focus-visible:outline-error-400 dark:border-error-400 dark:focus:border-error-400';
const ICON_BTN =
	'absolute end-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300';
const CONTENT =
	'z-99999 min-w-(--reka-combobox-trigger-width) overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark';
const ITEM =
	'relative flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:text-gray-300 data-[highlighted]:bg-gray-100 data-[state=checked]:bg-brand-50 data-[state=checked]:text-brand-600 dark:text-gray-300 dark:data-[disabled]:text-white/15 dark:data-[highlighted]:bg-white/5 dark:data-[state=checked]:bg-brand-500/15 dark:data-[state=checked]:text-brand-400';
const DOT = 'h-3 w-3 shrink-0 rounded-full';
const NOTE = 'flex items-center gap-2 px-3 py-2 text-theme-sm text-gray-500 dark:text-gray-400';
</script>

<template>
	<div>
		<label v-if="label" :for="id" class="mb-1.5 block text-sm font-semibold text-gray-800 dark:text-white/90">
			{{ label }}
		</label>
		<ComboboxRoot
			:model-value="modelValue"
			:disabled="disabled"
			:ignore-filter="ignoreFilter"
			@update:model-value="emit('update:modelValue', $event as string | number)"
		>
			<ComboboxAnchor class="relative">
				<span
					v-if="$slots['prepend'] || selectedIcon || selectedColor"
					data-prepend
					class="pointer-events-none absolute start-4 top-1/2 z-1 flex -translate-y-1/2 text-gray-500 dark:text-gray-400"
				>
					<slot name="prepend">
						<BoIcon
							v-if="selectedIcon"
							:name="selectedIcon"
							size="sm"
							:style="selectedColor ? { color: selectedColor } : {}"
						/>
						<span v-else :class="DOT" :style="{ backgroundColor: selectedColor! }" aria-hidden="true" />
					</slot>
				</span>
				<ComboboxInput
					:id="id"
					:display-value="displayValue"
					:placeholder="placeholder"
					:aria-labelledby="ariaLabelledby"
					:aria-invalid="invalid || !!error ? 'true' : undefined"
					:aria-describedby="describedBy"
					:class="[
						FIELD,
						$slots['prepend'] || selectedIcon || selectedColor ? 'ps-11' : 'ps-4',
						{ 'pe-20': $slots['append'] },
						invalid || error ? FIELD_INVALID : FIELD_VALID,
					]"
					@update:model-value="onSearch"
				/>
				<span
					v-if="$slots['append']"
					data-append
					class="pointer-events-none absolute end-11 top-1/2 z-1 flex -translate-y-1/2 text-gray-500 dark:text-gray-400"
				>
					<slot name="append" />
				</span>
				<!-- Not focusable (Reka tabindex -1) and the input is the combobox: hidden from assistive tech. -->
				<ComboboxTrigger :class="ICON_BTN" aria-hidden="true">
					<BoIcon name="expand_more" />
				</ComboboxTrigger>
			</ComboboxAnchor>
			<ComboboxPortal>
				<ComboboxContent
					position="popper"
					:side-offset="4"
					:class="[
						CONTENT,
						shortMenu
							? 'max-h-[min(30vh,var(--reka-combobox-content-available-height))]'
							: 'max-h-(--reka-combobox-content-available-height)',
					]"
					:aria-busy="loading ? 'true' : undefined"
				>
					<ComboboxViewport class="custom-scrollbar">
						<div v-if="loading" :class="NOTE">
							<BoIcon
								name="progress_activity"
								size="sm"
								class="animate-spin text-gray-500 motion-reduce:animate-none dark:text-gray-400"
							/>
							{{ t('loading') }}
						</div>
						<template v-else>
							<ComboboxEmpty :class="NOTE">{{ t('no_results') }}</ComboboxEmpty>
							<ComboboxItem
								v-for="item in items"
								:key="item.value"
								:value="item.value"
								:text-value="item.text"
								:class="ITEM"
							>
								<span class="flex min-w-0 items-center gap-2">
									<template v-if="!allowOther">
										<BoIcon
											v-if="iconOf(item)"
											:name="iconOf(item)!"
											size="sm"
											:style="colorOf(item) ? { color: colorOf(item)! } : {}"
										/>
										<span
											v-else-if="colorOf(item)"
											:class="DOT"
											:style="{ backgroundColor: colorOf(item)! }"
											aria-hidden="true"
										/>
									</template>
									<span>{{ item.text }}</span>
								</span>
								<ComboboxItemIndicator><BoIcon name="check" size="sm" /></ComboboxItemIndicator>
							</ComboboxItem>
							<ComboboxItem v-if="otherText" :value="otherText" :text-value="otherText" :class="ITEM">
								<span class="flex items-center gap-2">
									<BoIcon name="add" size="sm" />
									{{ otherText }}
								</span>
							</ComboboxItem>
						</template>
					</ComboboxViewport>
				</ComboboxContent>
			</ComboboxPortal>
		</ComboboxRoot>
		<p v-if="hint" :id="hintId" class="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
		<p
			v-if="error"
			:id="errorId"
			role="alert"
			class="mt-1.5 flex items-center gap-1 text-theme-xs text-error-600 dark:text-error-400"
		>
			<BoIcon name="error" size="sm" />
			{{ error }}
		</p>
	</div>
</template>
