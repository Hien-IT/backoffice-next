import { createI18n } from 'vue-i18n';

export const FALLBACK_LOCALE = 'en-US';

// One file per language (<locale>.ts): adding a language is adding a file.
const modules = import.meta.glob<{ default: Record<string, string> }>('./*-*.ts', { eager: true });

export const messages: Record<string, Record<string, string>> = Object.fromEntries(
	Object.entries(modules).map(([path, module]) => [path.slice(2, -3), module.default]),
);

export function createAppI18n(locale: string = navigator.language) {
	return createI18n({
		legacy: false,
		locale: locale in messages ? locale : FALLBACK_LOCALE,
		fallbackLocale: FALLBACK_LOCALE,
		messages,
	});
}
