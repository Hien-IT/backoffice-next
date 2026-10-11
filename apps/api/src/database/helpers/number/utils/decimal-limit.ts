// Ported from directus/api/src/database/helpers/number/utils/decimal-limit.ts
import { DEFAULT_NUMERIC_PRECISION, DEFAULT_NUMERIC_SCALE } from '@backoffice/constants';

export function calculateDecimalLimit(precision: number | null, scale: number | null) {
	if (precision === null || scale === null) {
		precision = DEFAULT_NUMERIC_PRECISION;
		scale = DEFAULT_NUMERIC_SCALE;
	}

	const max = 10 ** (precision - scale) - 10 ** -scale;
	const min = -(10 ** (precision - scale)) + 10 ** -scale;

	return { max, min };
}
