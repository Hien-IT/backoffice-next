<!-- Ported from directus/app/src/interfaces/translations/translation-form.vue -->
<script setup lang="ts">
// Backoffice: v-form -> BoForm (no `inline` prop, D-55), v-remove -> BoRemove, usePermissions ->
// ./use-permissions.ts (store only, see there). The activator icon is a button labelled `enable`; the secondary
// colors are the theme blue-light tint (DR `--theme--secondary`).
import { isEmpty } from 'lodash-es';
import { computed, nextTick, ref, watch } from 'vue';
import BoIcon from '../../components/BoIcon.vue';
import BoForm from '../../components/form/BoForm.vue';
import type { RelationM2M } from '../../composables/use-relation-m2m.ts';
import type { DisplayItem } from '../../composables/use-relation-multiple.ts';
import LanguageSelect, { type LanguageOption } from './LanguageSelect.vue';
import BoRemove from '../../components/BoRemove.vue';
import { usePermissions } from './use-permissions.ts';

const {
	languageOptions,
	disabled = false,
	nonEditable = false,
	autofocus = false,
	relationInfo = undefined,
	getItemWithLang,
	displayItems,
	fetchedItems,
	getItemEdits,
	isLocalItem,
	remove,
	loading = false,
	updateValue,
	secondary = false,
	triggerAttrs = undefined,
} = defineProps<{
	languageOptions: LanguageOption[];
	disabled?: boolean | undefined;
	nonEditable?: boolean | undefined;
	autofocus?: boolean | undefined;
	relationInfo?: RelationM2M | undefined;
	getItemWithLang: (items: Record<string, any>[], lang: string | undefined) => DisplayItem | undefined;
	loading?: boolean | undefined;
	displayItems: DisplayItem[];
	fetchedItems: Record<string, any>[];
	getItemEdits: (item: DisplayItem) => DisplayItem;
	isLocalItem: (item: DisplayItem) => boolean;
	remove: (...items: DisplayItem[]) => void;
	updateValue: (item: DisplayItem | undefined, lang: string | undefined) => void;
	secondary?: boolean | undefined;
	/** Backoffice: form linking of the language menu trigger (FORM_FIELD_A11Y). */
	triggerAttrs?: Record<string, unknown> | undefined;
}>();

const lang = defineModel<string>('lang');

const selectedLanguage = computed(() => languageOptions.find((optLang) => lang.value === optLang.value));

const item = computed(() => {
	const item = getItemWithLang(displayItems, lang.value);
	if (item === undefined) return undefined;

	const itemEdits = getItemEdits(item);

	if (isEmpty(itemEdits) && item.$type === 'deleted') return item;

	return itemEdits;
});

const itemInitial = computed(() => getItemWithLang(fetchedItems, lang.value));

const itemPrimaryKey = computed(() => relationInfo && itemInitial.value?.[relationInfo.junctionPrimaryKeyField.field]);

const itemNew = computed(() => !!(relationInfo && itemPrimaryKey.value === undefined));

const {
	itemPermissions: { saveAllowed, fields, deleteAllowed },
} = usePermissions(
	computed(() => relationInfo?.junctionCollection.collection ?? null),
	itemPrimaryKey,
	itemNew,
);

// Unmount the form when fields or lang change to avoid WYSIWYG crashing while Vue manipulates the DOM.
const formReady = ref(true);

watch([fields, lang], async () => {
	formReady.value = false;
	await nextTick();
	formReady.value = true;
});

const activatorDisabled = computed(() => {
	return (
		disabled || (!item.value && !saveAllowed.value) || (item.value && !deleteAllowed.value && !isLocalItem(item.value))
	);
});

const { transition, iconName, onEnableTranslation, onMousedown, onMouseup, onTransitionEnd } = useActivatorButton();

function useActivatorButton() {
	const pressing = ref(false);
	const pressed = ref(false);
	const transition = ref(false);

	const iconName = computed(() =>
		(pressed.value || pressing.value) && !activatorDisabled.value ? 'check_box' : 'check_box_outline_blank',
	);

	watch([item, lang], ([newItem, newLang], [oldItem, oldLang]) => {
		const isInitialItem = isEmpty(newItem) && isEmpty(oldItem);
		transition.value = isInitialItem ? false : newItem !== oldItem && newLang === oldLang;
	});

	return {
		transition,
		iconName,
		onEnableTranslation,
		onMousedown,
		onMouseup,
		onTransitionEnd,
	};

	function onEnableTranslation(lang?: string, item?: DisplayItem, itemInitial?: DisplayItem) {
		if (!isEmpty(item) || !isEmpty(itemInitial)) return;
		updateValue(item, lang);
	}

	function onMousedown() {
		pressing.value = true;
		document.addEventListener('mouseup', onMouseupOutside);
	}

	function onMouseupOutside() {
		pressing.value = false;
		document.removeEventListener('mouseup', onMouseupOutside);
	}

	function onMouseup() {
		pressed.value = true;
	}

	function onTransitionEnd() {
		pressed.value = false;
	}
}

function onToggleDelete(item: DisplayItem, itemInitial?: DisplayItem) {
	if (!isEmpty(item)) {
		remove(item);
		return;
	}

	if (isEmpty(itemInitial)) return;

	remove(itemInitial);
}

// Backoffice: DR `rotate-in` / `rotate-out` transitions as Tailwind classes, off under reduced motion.
const ROTATE = 'transition-transform duration-200 motion-reduce:transition-none';

const transitionProps = computed(() => {
	if (!transition.value) return { duration: 0 };

	return {
		enterActiveClass: ROTATE,
		leaveActiveClass: ROTATE,
		enterFromClass: item.value ? 'rotate-90' : '-rotate-90',
		leaveToClass: item.value ? '-rotate-90' : 'rotate-90',
	};
});
</script>

<template>
	<div :class="{ secondary }" :data-lang="lang">
		<LanguageSelect
			v-model="lang"
			:items="languageOptions"
			:danger="item?.$type === 'deleted'"
			:secondary
			:disabled="disabled"
			:non-editable
			:trigger-attrs
		>
			<template #prepend>
				<span v-if="loading" class="inline-block h-8 w-8" />

				<Transition
					v-else
					v-bind="transitionProps"
					mode="out-in"
					@after-leave="onTransitionEnd"
					@leave-cancelled="onTransitionEnd"
				>
					<span v-if="item || nonEditable" class="inline-flex h-8 w-8 items-center justify-center">
						<BoIcon name="translate" size="sm" :class="{ 'opacity-50': activatorDisabled }" />
					</span>

					<button
						v-else
						type="button"
						class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
						:aria-label="$t('enable')"
						:title="!activatorDisabled ? $t('enable') : undefined"
						:disabled="activatorDisabled"
						data-testid="enable-translation"
						@click.stop="onEnableTranslation(lang, item, itemInitial)"
						@mousedown="onMousedown"
						@mouseup="onMouseup"
					>
						<BoIcon :name="iconName" size="sm" />
					</button>
				</Transition>
			</template>

			<template #controls="{ active, toggle }">
				<BoRemove
					v-if="item && !(nonEditable && item.$type !== 'deleted')"
					:disabled="!!activatorDisabled"
					:item-type="item.$type"
					:item-info="relationInfo"
					:item-is-local="isLocalItem(item)"
					:item-edits="getItemEdits(item)"
					@action="onToggleDelete(item, itemInitial)"
				/>

				<slot name="split-view" :active :toggle />
			</template>
		</LanguageSelect>

		<BoForm
			v-if="selectedLanguage && formReady"
			:key="selectedLanguage.value"
			class="mt-7"
			:class="!item && !disabled ? 'opacity-50 hover:opacity-100 focus-within:opacity-100' : undefined"
			:primary-key="itemPrimaryKey ?? '+'"
			:disabled="disabled || !saveAllowed || item?.$type === 'deleted'"
			:non-editable
			:loading="loading"
			:fields="fields"
			:model-value="item ?? null"
			:initial-values="itemInitial ?? null"
			:badge="selectedLanguage.text"
			:direction="selectedLanguage.direction"
			:autofocus="autofocus"
			@update:model-value="updateValue($event, lang)"
		/>

		<hr class="mt-5 border-gray-200 dark:border-gray-800" />
	</div>
</template>
