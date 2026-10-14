// Ported from directus/app/src/stores/translations.ts
// Backoffice: only loadTranslations and the merge into i18n; `create` belongs to the Settings > Translations module
// (feature 013+).
import { defineStore } from 'pinia';
import { ref, unref, watch } from 'vue';
import { i18n } from '../lang/index.ts';
import { fetchAll } from '../utils/fetch-all.ts';
import { getLiteralInterpolatedTranslation } from '../utils/get-literal-interpolated-translation.ts';

export interface Translation {
	language: string;
	key: string;
	value: string;
}

export const useTranslationsStore = defineStore('translations', () => {
	const loading = ref(false);
	const translations = ref<Translation[]>([]);
	const lang = ref<string>('en-US');

	const loadTranslations = async (newLang = unref(lang)) => {
		loading.value = true;

		try {
			translations.value = await fetchAll<Translation>(`/translations`, {
				params: {
					fields: ['language', 'key', 'value'],
					filter: {
						language: { _eq: newLang },
					},
				},
			});

			lang.value = newLang;
		} catch {
			// No public permissions for translations
		} finally {
			loading.value = false;
		}
	};

	watch(translations, (newTranslations) => {
		const localeMessages = newTranslations?.reduce(
			(result: Record<string, string>, { key, value }: { key: string; value: string }) => {
				result[key] = getLiteralInterpolatedTranslation(value, true);
				return result;
			},
			{} as Record<string, string>,
		);

		if (localeMessages) {
			i18n.global.mergeLocaleMessage(unref(lang), localeMessages);
		}
	});

	return { loading, translations, loadTranslations };
});
