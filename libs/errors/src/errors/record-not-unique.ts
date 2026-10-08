// Ported from directus/packages/errors/src/errors/record-not-unique.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface RecordNotUniqueErrorExtensions {
	collection: string | null;
	field: string | null;
	value: string | null;
	primaryKey?: boolean;
}

export const messageConstructor = ({ collection, field, value }: RecordNotUniqueErrorExtensions): string => {
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

	message += `has to be unique.`;

	return message;
};

export const RecordNotUniqueError: BackofficeErrorConstructor<RecordNotUniqueErrorExtensions> =
	createError<RecordNotUniqueErrorExtensions>(ErrorCode.RecordNotUnique, messageConstructor, 400);
