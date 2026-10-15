<!-- Ported from directus/app/src/interfaces/_system/system-input-translated-string/custom-translations-tooltip.vue -->
<script setup lang="ts">
// Backoffice: the v-menu is a disclosure (button with aria-expanded, panel under the key row): a popover inside the
// key menu's popover is closed by the outer layer. The `translations` tooltip is the button label.
import { type Ref, ref, useId } from 'vue';
import BoIcon from '../../../components/BoIcon.vue';
import ValueNull from '../../../components/render/ValueNull.vue';
import type { Translation } from '../../../stores/translations.ts';
import { fetchAll } from '../../../utils/fetch-all.ts';

const props = defineProps<{ translationKey: string }>();

const translations: Ref<Translation[]> = ref([]);
const loading = ref(false);
const active = ref(false);
const panelId = useId();

const fetchTranslation = async () => {
	loading.value = true;

	try {
		translations.value = await fetchAll(`/translations`, {
			params: {
				fields: ['language', 'key', 'value'],
				sort: ['language'],
				filter: {
					key: { _eq: props.translationKey },
				},
			},
		});
	} catch {
		// Ignored
	} finally {
		loading.value = false;
	}
};

const clicked = () => {
	active.value = !active.value;

	if (!loading.value && translations.value.length === 0) {
		fetchTranslation();
	}
};
</script>

<template>
	<button
		type="button"
		class="inline-flex size-7 shrink-0 items-center justify-center rounded group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:focus-visible:outline-brand-400"
		:class="active ? 'opacity-100' : 'opacity-0'"
		:aria-label="`${$t('translations')}: ${translationKey}`"
		:aria-expanded="active"
		:aria-controls="panelId"
		@click="clicked"
	>
		<BoIcon name="info" size="sm" />
	</button>
	<div
		v-if="active"
		:id="panelId"
		class="custom-translations w-full divide-y divide-gray-200 rounded-lg bg-white px-3 py-2 text-theme-sm dark:divide-gray-800 dark:bg-gray-dark"
	>
		<p v-if="translations.length === 0" class="m-0 text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
			{{ $t('loading') }}
		</p>
		<div v-for="item in translations" v-else :key="item.language" class="py-1.5 first:pt-0 last:pb-0">
			<p class="m-0 flex items-center gap-1 text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
				<BoIcon name="translate" size="sm" />
				{{ item.language }}
			</p>
			<ValueNull v-if="!item.value" />
			<p v-else class="m-0 truncate text-gray-800 dark:text-white/90">{{ item.value }}</p>
		</div>
	</div>
</template>
