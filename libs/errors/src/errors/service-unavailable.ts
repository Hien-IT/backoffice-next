// Ported from directus/packages/errors/src/errors/service-unavailable.ts
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface ServiceUnavailableErrorExtensions {
	service: string;
	reason: string;
}

export const messageConstructor = ({ service, reason }: ServiceUnavailableErrorExtensions) =>
	`Service "${service}" is unavailable. ${reason}.`;

export const ServiceUnavailableError: BackofficeErrorConstructor<ServiceUnavailableErrorExtensions> =
	createError<ServiceUnavailableErrorExtensions>(ErrorCode.ServiceUnavailable, messageConstructor, 503);
