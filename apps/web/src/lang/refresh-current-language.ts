// Ported from directus/app/src/lang/refresh-current-language.ts
import { useFieldsStore } from '../stores/fields.ts';
import { useTranslationsStore } from '../stores/translations.ts';
import { useUserStore } from '../stores/user.ts';

export async function refreshCurrentLanguage() {
	const fieldsStore = useFieldsStore();
	const userStore = useUserStore();
	const translationsStore = useTranslationsStore();

	try {
		await translationsStore.loadTranslations(userStore.language);

		// Refetch fields in order to translate
		await fieldsStore.hydrate();
	} catch {
		// eslint-disable-next-line no-console
		console.error('Failed loading translations');
	}
}
