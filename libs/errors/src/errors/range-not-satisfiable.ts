// Ported from directus/packages/errors/src/errors/range-not-satisfiable.ts
import type { Range } from '@backoffice/types';
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface RangeNotSatisfiableErrorExtensions {
	range: Range;
}

export const messageConstructor = ({ range }: RangeNotSatisfiableErrorExtensions) => {
	const rangeString = `"${range.start ?? ''}-${range.end ?? ''}"`;
	return `Range ${rangeString} is invalid or the file's size doesn't match the requested range.`;
};

export const RangeNotSatisfiableError: BackofficeErrorConstructor<RangeNotSatisfiableErrorExtensions> =
	createError<RangeNotSatisfiableErrorExtensions>(ErrorCode.RangeNotSatisfiable, messageConstructor, 416);
