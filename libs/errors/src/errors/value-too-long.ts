// Ported from directus/packages/errors/src/errors/value-too-long.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface ValueTooLongErrorExtensions {
	collection: string | null;
	field: string | null;
	value: string | null;
}

export const messageConstructor = ({ collection, field, value }: ValueTooLongErrorExtensions): string => {
	let message = 'Value ';

	if (value) {
		message += `"${value}" `;
	}

	if (field) {
		message += `for field "${field}" `;
	}

	if (collection) {
		message += `in collection "${collection}" `;
	}

	message += `is too long.`;

	return message;
};

export const ValueTooLongError: BackofficeErrorConstructor<ValueTooLongErrorExtensions> =
	createError<ValueTooLongErrorExtensions>(ErrorCode.ValueTooLong, messageConstructor, 400);
