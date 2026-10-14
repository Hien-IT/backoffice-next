// Ported from directus/app/src/utils/localized-format.ts
// Backoffice: `!`/casts only for the strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
import { format as formatOriginal } from 'date-fns';
import { getDateFNSLocale } from './get-date-fns-locale.ts';

type LocalizedFormat = (...a: Parameters<typeof formatOriginal>) => string;

export const localizedFormat: LocalizedFormat = (date, format, options): string => {
	return formatOriginal(date, format, {
		...options,
		locale: getDateFNSLocale()!,
	});
};
