// Ported from directus/app/src/operations/throw-error/index.ts
import { ErrorCode } from './error-codes.ts';
import { defineOperationApp } from '../types.ts';

// Backoffice: the code, status and message of InternalServerError (directus/packages/errors/src/errors/internal.ts),
// without importing @directus/errors into the web app (spec 017 FR-041, research R1).
const FALLBACK_ERROR = { code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'An unexpected error occurred.' };

export default defineOperationApp({
	id: 'throw-error',
	icon: 'error',
	name: '$t:operations.throw-error.name',
	description: '$t:operations.throw-error.description',
	overview: ({ code, status, message }) => [
		{
			label: '$t:operations.throw-error.code',
			text: code ?? FALLBACK_ERROR.code,
		},
		{
			label: '$t:operations.throw-error.status',
			text: status ?? FALLBACK_ERROR.status.toString(),
		},
		{
			label: '$t:operations.throw-error.message',
			text: message ?? FALLBACK_ERROR.message,
		},
	],
	options: () => [
		{
			field: 'code',
			name: '$t:operations.throw-error.code',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'select-dropdown',
				options: {
					choices: Object.values(ErrorCode).map((code) => ({
						text: code,
						value: code,
					})),
					allowOther: true,
					placeholder: FALLBACK_ERROR.code,
				},
			},
		},
		{
			field: 'status',
			name: '$t:operations.throw-error.status',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'select-dropdown',
				options: {
					choices: [
						{
							text: '400 (Bad Request)',
							value: '400',
						},
						{
							text: '401 (Unauthorized)',
							value: '401',
						},
						{
							text: '403 (Forbidden)',
							value: '403',
						},
						{
							text: '404 (Not Found)',
							value: '404',
						},
						{
							text: '405 (Method Not Allowed)',
							value: '405',
						},
						{
							text: '422 (Unprocessable Entity)',
							value: '422',
						},
						{
							text: '429 (Too Many Requests)',
							value: '429',
						},
						{
							text: '500 (Internal Server Error)',
							value: '500',
						},
					],
					allowOther: true,
					placeholder: FALLBACK_ERROR.status.toString(),
				},
			},
		},
		{
			field: 'message',
			name: '$t:operations.throw-error.message',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
				options: {
					placeholder: FALLBACK_ERROR.message,
				},
			},
		},
	],
});
