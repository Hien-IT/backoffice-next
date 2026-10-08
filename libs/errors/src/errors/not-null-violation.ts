// Ported from directus/packages/errors/src/errors/not-null-violation.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface NotNullViolationErrorExtensions {
	collection: string | null;
	field: string | null;
}

export const messageConstructor = ({ collection, field }: NotNullViolationErrorExtensions): string => {
	let message = 'Value ';

	if (field) {
		message += `for field "${field}" `;
	}

	if (collection) {
		message += `in collection "${collection}" `;
	}

	message += `can't be null.`;

	return message;
};

export const NotNullViolationError: BackofficeErrorConstructor<NotNullViolationErrorExtensions> =
	createError<NotNullViolationErrorExtensions>(ErrorCode.NotNullViolation, messageConstructor, 400);
