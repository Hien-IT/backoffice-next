// Ported from directus/packages/errors/src/errors/timeout.ts
import ms from 'ms';
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface TimeoutErrorExtensions {
	category: string;
	/** in ms */
	duration: number;
}

export const messageConstructor = ({ category, duration }: TimeoutErrorExtensions) =>
	`${category} timed out after ${ms(duration, { long: true })}.`;

export const TimeoutError: BackofficeErrorConstructor<TimeoutErrorExtensions> = createError<TimeoutErrorExtensions>(
	ErrorCode.OutOfTime,
	messageConstructor,
	408,
);
