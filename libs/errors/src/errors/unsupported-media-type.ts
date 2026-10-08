// Ported from directus/packages/errors/src/errors/unsupported-media-type.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface UnsupportedMediaTypeErrorExtensions {
	mediaType: string;
	where: string;
}

export const messageConstructor = (extensions: UnsupportedMediaTypeErrorExtensions) =>
	`Unsupported media type "${extensions.mediaType}" in ${extensions.where}.`;

export const UnsupportedMediaTypeError: BackofficeErrorConstructor<UnsupportedMediaTypeErrorExtensions> =
	createError<UnsupportedMediaTypeErrorExtensions>(ErrorCode.UnsupportedMediaType, messageConstructor, 415);
