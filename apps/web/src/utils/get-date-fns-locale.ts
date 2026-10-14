// Ported from directus/app/src/utils/get-date-fns-locale.ts
// Backoffice: only the date-fns locales of the bundled languages (en-US, vi-VN, D-46); other languages fall back
// through the language prefix to en-US as in Directus.
import type { Locale } from 'date-fns';
import { i18n } from '../lang/index.ts';

const locales: { lang: string; locale: Locale }[] = [];

export function getDateFNSLocale(): Locale | undefined {
	const currentLang = i18n.global.locale.value;
	return locales.find(({ lang }) => currentLang === lang)?.locale;
}

export async function loadDateFNSLocale(lang: string) {
	const localesToTry = [lang, (lang.split('-') as [string, string])[0], 'en-US'];

	let locale;

	for (const l of localesToTry) {
		try {
			const mod = await importDateLocale(l);
			locale = mod.default;
			locales.push({ lang, locale });
			break;
		} catch {
			continue;
		}
	}

	return locale;
}

export function importDateLocale(locale: string): Promise<any> {
	switch (locale) {
		case 'en-US':
			return import('date-fns/locale/en-US');
		case 'vi':
			return import('date-fns/locale/vi');
		default:
			return Promise.resolve();
	}
}
