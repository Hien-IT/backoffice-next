// Ported from directus/packages/errors/src/errors/invalid-payload.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface InvalidPayloadErrorExtensions {
	reason: string;
}

export const messageConstructor = ({ reason }: InvalidPayloadErrorExtensions) => `Invalid payload. ${reason}.`;

export const InvalidPayloadError: BackofficeErrorConstructor<InvalidPayloadErrorExtensions> =
	createError<InvalidPayloadErrorExtensions>(ErrorCode.InvalidPayload, messageConstructor, 400);
