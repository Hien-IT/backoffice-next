// Ported from directus/app/src/lang/set-language.ts
// Backoffice: only en-US and vi-VN are bundled (D-46). Another available language loads the en-US strings, and
// `html[lang]` names the language actually loaded (spec "Ngôn ngữ"). The Backoffice overlay is merged on top.
import { useTranslationsStore } from '../stores/translations.ts';
import { loadDateFNSLocale } from '../utils/get-date-fns-locale.ts';
import availableLanguages from './available-languages.json';
import { FALLBACK_LANGUAGE, i18n, type Language, loadedLanguages } from './index.ts';

type Messages = Record<string, unknown>;

const bundled: Record<string, () => Promise<[Messages, Messages]>> = {
	'vi-VN': () =>
		Promise.all([
			import('./translations/vi-VN.json').then((m) => m.default),
			import('./overlay/vi-VN.ts').then((m) => m.default),
		]),
};

/** The language whose strings are used for `lang`: itself when bundled, en-US otherwise (D-46). */
export function getEffectiveLanguage(lang: string): Language {
	return lang === FALLBACK_LANGUAGE || lang in bundled ? (lang as Language) : FALLBACK_LANGUAGE;
}

// Backoffice: `string` (callers pass user.language or settings.default_language); Directus' YAML import types make
// its Language just as wide. Unknown values are checked below.
export async function setLanguage(lang: string): Promise<boolean> {
	const translationsStore = useTranslationsStore();

	if (Object.keys(availableLanguages).includes(lang) === false) {
		// eslint-disable-next-line no-console
		console.warn(`"${lang}" is not an available language in the Backoffice app.`);
	} else {
		let effective = getEffectiveLanguage(lang);

		if (loadedLanguages.includes(effective) === false) {
			try {
				const [translations, overlay] = await bundled[effective]!();
				i18n.global.mergeLocaleMessage(effective, { ...translations, ...overlay });
				loadedLanguages.push(effective);
			} catch (err: any) {
				// eslint-disable-next-line no-console
				console.warn(err);
				effective = FALLBACK_LANGUAGE;
			}
		}

		i18n.global.locale.value = effective;

		(document.querySelector('html') as HTMLElement).setAttribute('lang', effective);
	}

	try {
		// ponytail: custom translations of a non-bundled language merge into a locale that is not shown (locale stays
		// en-US); revisit if more languages get bundled or D-46 changes.
		await translationsStore.loadTranslations(lang);

		// Backoffice: collectionsStore.translateCollections() and fieldsStore.translateFields() come with the data
		// model stores (feature 013+).

		await loadDateFNSLocale(lang);
	} catch {
		// eslint-disable-next-line no-console
		console.error('Failed loading translations');
	}

	return true;
}
