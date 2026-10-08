// Ported from directus/packages/errors/src/errors/contains-null-values.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface ContainsNullValuesErrorExtensions {
	collection: string;
	field: string;
}

export const messageConstructor = ({ collection, field }: ContainsNullValuesErrorExtensions) =>
	`Field "${field}" in collection "${collection}" contains null values.`;

export const ContainsNullValuesError: BackofficeErrorConstructor<ContainsNullValuesErrorExtensions> =
	createError<ContainsNullValuesErrorExtensions>(ErrorCode.ContainsNullValues, messageConstructor, 400);
