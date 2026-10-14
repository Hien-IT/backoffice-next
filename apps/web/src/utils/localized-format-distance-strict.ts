// Ported from directus/app/src/utils/localized-format-distance-strict.ts
// Backoffice: `!`/casts only for the strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes).
import { formatDistanceStrict } from 'date-fns';
import { getDateFNSLocale } from './get-date-fns-locale.ts';

type LocalizedFormatDistanceStrict = (...a: Parameters<typeof formatDistanceStrict>) => string;

export const localizedFormatDistanceStrict: LocalizedFormatDistanceStrict = (date, baseDate, options): string => {
	return formatDistanceStrict(date, baseDate, {
		...options,
		locale: getDateFNSLocale()!,
	});
};
