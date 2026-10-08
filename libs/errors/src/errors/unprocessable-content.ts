// Ported from directus/packages/errors/src/errors/unprocessable-content.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface UnprocessableContentErrorExtensions {
	reason: string;
}

const messageConstructor = (extensions: UnprocessableContentErrorExtensions) =>
	`Can't process content. ${extensions.reason}.`;

export const UnprocessableContentError: BackofficeErrorConstructor<UnprocessableContentErrorExtensions> =
	createError<UnprocessableContentErrorExtensions>(ErrorCode.UnprocessableContent, messageConstructor, 422);
