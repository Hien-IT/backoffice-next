// Backoffice (spec 033, FR-038, amendment 2026-11-18): the language of the documentation content follows the app
// language: Vietnamese for vi-VN, English for every other language. The nav of that language goes with it.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { docsLangOf, docsNavs } from '../../docs/nav.ts';

export function useDocsLang() {
	const { locale } = useI18n();
	const lang = computed(() => docsLangOf(String(locale.value)));
	const nav = computed(() => docsNavs[lang.value]);

	return { lang, nav };
}
