// Ported from directus/packages/errors/src/errors/email-limit-exceeded.ts
import ms from 'ms';
import { createError, type BackofficeErrorConstructor, ErrorCode } from '../index.js';

export interface EmailLimitExceededErrorExtensions {
	points?: number | undefined;
	duration?: number | undefined;
	message?: string | undefined;
}

export const messageConstructor = (extensions: EmailLimitExceededErrorExtensions): string => {
	const message = ['Email sending limit exceeded.'];

	if (typeof extensions.points === 'number' && typeof extensions.duration === 'number') {
		const duration = ms(extensions.duration * 1000, { long: true });
		const plural = extensions.points !== 1 ? 's' : '';
		message.push(`Limit of ${extensions.points} email${plural} every ${duration}.`);
	}

	if (extensions.message) {
		message.push(extensions.message);
	}

	return message.join(' ');
};

export const EmailLimitExceededError: BackofficeErrorConstructor<EmailLimitExceededErrorExtensions> =
	createError<EmailLimitExceededErrorExtensions>(ErrorCode.EmailLimitExceeded, messageConstructor, 429);
