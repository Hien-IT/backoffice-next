<!-- Ported from directus/app/src/interfaces/_system/system-input-translated-string/input-translated-string.vue -->
<script setup lang="ts">
// Backoffice: the attached v-menu is a Reka Popover anchored on the field (trigger: the translate button, labelled
// `translations`); the list rows are buttons, the info button of a row sits next to it (no nested buttons). The
// field ids come from FormField (FR-094). An emptied input gives null, as v-input `nullable`.
import { snakeCase } from 'lodash-es';
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { computed, inject, ref, unref, watch } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import BoInput from '../../../components/BoInput.vue';
import BoProgressLinear from '../../../components/BoProgressLinear.vue';
import DrawerItem from '../../../components/drawers/DrawerItem.vue';
import { FORM_FIELD_A11Y } from '../../../components/form/types.ts';
import type { Translation } from '../../../stores/translations.ts';
import { useTranslationsStore } from '../../../stores/translations.ts';
import { useUserStore } from '../../../stores/user.ts';
import { fetchAll } from '../../../utils/fetch-all.ts';
import { unexpectedError } from '../../../utils/unexpected-error.ts';
import CustomTranslationsTooltip from './CustomTranslationsTooltip.vue';

const translationPrefix = '$t:';

const props = withDefaults(
	defineProps<{
		value?: string | null;
		autofocus?: boolean;
		disabled?: boolean;
		placeholder?: string | null;
	}>(),
	{
		value: null,
		autofocus: false,
		disabled: false,
		placeholder: null,
	},
);

const emit = defineEmits(['input']);

const a11y = inject(FORM_FIELD_A11Y, null);

const menuActive = ref(false);
const hasValidKey = ref<boolean>(false);
const isFocused = ref<boolean>(false);
const searchValue = ref<string | null>(null);

const loading = ref(false);
const translationsKeys = ref<string[]>([]);
const translationsStore = useTranslationsStore();

const isCustomTranslationDrawerOpen = ref<boolean>(false);

const userStore = useUserStore();

const fetchTranslationsKeys = async () => {
	loading.value = true;

	try {
		const response = await fetchAll<{ key: string }>(`/translations`, {
			params: {
				fields: ['key'],
				groupBy: ['key'],
			},
		});

		translationsKeys.value = response.map((t) => t.key);
	} catch (error) {
		unexpectedError(error);
	} finally {
		loading.value = false;
	}
};

fetchTranslationsKeys();

const filteredTranslationKeys = computed(() => {
	const keys = unref(translationsKeys);
	const filteredKeys = !searchValue.value ? keys : keys.filter((key) => key.includes(searchValue.value!));

	if (filteredKeys.length > 100) {
		return filteredKeys.slice(0, 100);
	}

	return filteredKeys;
});

const localValue = computed<string | null>({
	get() {
		return props.value;
	},
	set(val) {
		if (props.value === val) return;
		emit('input', val);
	},
});

const create = async (item: Translation) => {
	await translationsStore.create(item);
	await fetchTranslationsKeys();
	setValue(`${translationPrefix}${item.key}`);
};

watch(
	() => props.value,
	(newVal) => setValue(newVal),
	{ immediate: true },
);

const localValueWithoutPrefix = computed(() => (localValue.value ? getKeyWithoutPrefix(localValue.value) : null));

function getKeyWithoutPrefix(val: string) {
	return val.substring(translationPrefix.length);
}

function selectKey(key: string) {
	setValue(`${translationPrefix}${key}`);
	menuActive.value = false;
	searchValue.value = null;
}

function setValue(newValue: string | null) {
	if (newValue?.startsWith(translationPrefix)) newValue = newValue.replace(/\s/g, '_');
	localValue.value = newValue;
	if (!isFocused.value) checkKeyValidity();
}

function blur() {
	isFocused.value = false;
	checkKeyValidity();
}

function checkKeyValidity() {
	hasValidKey.value = localValue.value?.startsWith(translationPrefix) ?? false;
}

function openNewCustomTranslationDrawer() {
	menuActive.value = false;
	isCustomTranslationDrawerOpen.value = true;
}

const newTranslationDefaults = computed(() => {
	const defaults = {
		language: userStore.language,
	};

	if (localValue.value && !localValue.value.startsWith(translationPrefix)) {
		Object.assign(defaults, {
			key: snakeCase(localValue.value),
			value: localValue.value,
		});
	}

	return defaults;
});

// Backoffice: v-highlight, the first match of the search in the key.
function highlight(key: string) {
	const index = searchValue.value ? key.indexOf(searchValue.value) : -1;
	if (index === -1) return [key, '', ''];
	return [key.slice(0, index), searchValue.value!, key.slice(index + searchValue.value!.length)];
}

const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400';
const ROW = `flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-start text-theme-sm font-medium ${FOCUS}`;
</script>

<template>
	<div class="input-translated-string">
		<PopoverRoot v-model:open="menuActive">
			<PopoverAnchor as-child>
				<div class="relative">
					<div
						v-if="hasValidKey"
						class="flex h-11 w-full items-center rounded-lg border border-gray-300 px-4 pe-12 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900"
						:class="{ 'cursor-not-allowed bg-gray-50 dark:bg-white/[0.03]': disabled }"
					>
						<button
							:id="a11y?.inputId"
							type="button"
							class="selected-translation me-auto min-w-0 truncate rounded bg-brand-50 px-2 py-0.5 font-mono text-theme-sm text-brand-500 hover:bg-error-500 hover:text-white disabled:pointer-events-none dark:bg-brand-500/15 dark:text-brand-400"
							:class="FOCUS"
							:disabled="disabled"
							:aria-labelledby="a11y?.labelId"
							:aria-describedby="a11y?.describedBy"
							:title="$t('clear_value')"
							@click.stop="setValue(null)"
						>
							{{ value && getKeyWithoutPrefix(value) }}
						</button>
					</div>
					<BoInput
						v-else
						v-bind="a11y ? { id: a11y.inputId } : {}"
						class="translation-input pe-12"
						:model-value="localValue"
						:autofocus="autofocus"
						:placeholder="placeholder ?? ''"
						:disabled="disabled"
						:invalid="!!a11y?.invalid"
						:aria-labelledby="a11y?.labelId"
						:aria-describedby="a11y?.describedBy"
						@update:model-value="localValue = $event === '' ? null : $event"
						@focus="isFocused = true"
						@blur="blur"
						@keydown.enter="checkKeyValidity"
					/>
					<PopoverTrigger
						class="translate-icon absolute end-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400 dark:data-[state=open]:text-brand-400"
						:class="FOCUS"
						:disabled="disabled"
						:aria-label="$t('translations')"
					>
						<BoIcon name="translate" size="sm" />
					</PopoverTrigger>
				</div>
			</PopoverAnchor>

			<PopoverPortal>
				<PopoverContent
					:side-offset="4"
					align="start"
					:collision-padding="8"
					class="z-99999 max-h-(--reka-popover-content-available-height) w-(--reka-popover-trigger-width) min-w-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg custom-scrollbar dark:border-gray-800 dark:bg-gray-dark"
				>
					<div v-if="searchValue !== null || filteredTranslationKeys.length >= 25" class="search px-1 pb-2">
						<BoInput
							class="search-input"
							type="search"
							:model-value="searchValue"
							autofocus
							:placeholder="$t('interfaces.input-translated-string.search_placeholder')"
							:aria-label="$t('search')"
							@update:model-value="searchValue = $event"
						/>
					</div>

					<BoProgressLinear v-if="loading" indeterminate :aria-label="$t('loading')" />

					<ul class="m-0 list-none space-y-1 p-0">
						<li
							v-for="translationKey in filteredTranslationKeys"
							:key="translationKey"
							class="translation-key group flex flex-wrap items-center gap-1 rounded-lg pe-1"
							:class="
								localValue && translationKey === localValueWithoutPrefix
									? 'selected bg-brand-500 text-white'
									: 'text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
							"
						>
							<button
								type="button"
								:class="ROW"
								:aria-pressed="!!localValue && translationKey === localValueWithoutPrefix"
								@click="selectKey(translationKey)"
							>
								<BoIcon name="translate" size="sm" />
								<span class="min-w-0 truncate">
									<template v-for="(part, index) in highlight(translationKey)" :key="index">
										<mark
											v-if="index === 1"
											class="bg-transparent text-brand-500 in-[.selected]:text-white dark:text-brand-400 dark:in-[.selected]:text-white"
										>
											{{ part }}
										</mark>
										<span v-else>{{ part }}</span>
									</template>
								</span>
							</button>
							<CustomTranslationsTooltip :translation-key="translationKey" />
						</li>
						<li>
							<button
								type="button"
								class="new-custom-translation w-full text-brand-500 hover:bg-gray-100 dark:text-brand-400 dark:hover:bg-white/5"
								:class="ROW"
								@click="openNewCustomTranslationDrawer"
							>
								<BoIcon name="add" size="sm" />
								{{ $t('interfaces.input-translated-string.new_custom_translation') }}
							</button>
						</li>
					</ul>
				</PopoverContent>
			</PopoverPortal>
		</PopoverRoot>

		<DrawerItem
			v-model:active="isCustomTranslationDrawerOpen"
			collection="directus_translations"
			primary-key="+"
			:edits="newTranslationDefaults"
			@input="create($event as Translation)"
		/>
	</div>
</template>
