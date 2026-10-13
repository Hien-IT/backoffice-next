import { expect, test } from 'vitest';
import {
	ForbiddenError,
	InvalidPathParameterError,
	MethodNotAllowedError,
	RouteNotFoundError,
	ServiceUnavailableError,
	TimeoutError,
	UnprocessableContentError,
} from '../index.js';

// Messages, codes and statuses must stay identical to directus/packages/errors (FR-050).
test.each([
	[new ForbiddenError(), 'FORBIDDEN', 403, "You don't have permission to access this."],
	[new ForbiddenError({ reason: 'Nope' }), 'FORBIDDEN', 403, 'Nope'],
	[
		new InvalidPathParameterError({ reason: 'Bad id' }),
		'INVALID_PATH_PARAMETER',
		400,
		'Invalid path parameter. Bad id.',
	],
	[
		new MethodNotAllowedError({ allowed: ['GET', 'HEAD'], current: 'POST' }),
		'METHOD_NOT_ALLOWED',
		405,
		'Invalid method "POST" used. Should be one of "GET", "HEAD".',
	],
	[new RouteNotFoundError({ path: '/nope' }), 'ROUTE_NOT_FOUND', 404, "Route /nope doesn't exist."],
	[
		new ServiceUnavailableError({ service: 'api', reason: 'Under pressure' }),
		'SERVICE_UNAVAILABLE',
		503,
		'Service "api" is unavailable. Under pressure.',
	],
	[new TimeoutError({ category: 'Request', duration: 2000 }), 'OUT_OF_TIME', 408, 'Request timed out after 2 seconds.'],
	[
		new UnprocessableContentError({ reason: 'Too big' }),
		'UNPROCESSABLE_CONTENT',
		422,
		"Can't process content. Too big.",
	],
])('%s', (error, code, status, message) => {
	expect(error.name).toBe('DirectusError');
	expect(error.code).toBe(code);
	expect(error.status).toBe(status);
	expect(error.message).toBe(message);
});
