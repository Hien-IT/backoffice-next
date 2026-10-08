// Ported from directus/packages/errors/src/errors/limit-exceeded.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface LimitExceededErrorExtensions {
	category: string;
}

export const messageConstructor = ({ category }: LimitExceededErrorExtensions) => {
	return `${category} limit exceeded.`;
};

export const LimitExceededError: BackofficeErrorConstructor<LimitExceededErrorExtensions> =
	createError<LimitExceededErrorExtensions>(ErrorCode.LimitExceeded, messageConstructor, 403);
