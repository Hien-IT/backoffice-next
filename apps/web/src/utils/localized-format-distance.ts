// Ported from directus/app/src/utils/localized-format-distance.ts
// Backoffice: `!`/casts only for the strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
import { formatDistance as formatDistanceOriginal } from 'date-fns';
import { getDateFNSLocale } from './get-date-fns-locale.ts';

type LocalizedFormatDistance = (...a: Parameters<typeof formatDistanceOriginal>) => string;

export const localizedFormatDistance: LocalizedFormatDistance = (date, baseDate, options): string => {
	return formatDistanceOriginal(date, baseDate, {
		...options,
		locale: getDateFNSLocale()!,
	});
};
