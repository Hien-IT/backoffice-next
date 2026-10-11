import { InvalidPayloadError } from '@backoffice/errors';
import type { Request, Response } from 'express';
import { describe, expect, test } from 'vitest';
import useCollection from '../middleware/use-collection.js';
import { validateBatch } from '../middleware/validate-batch.js';
import { runMiddleware } from './run-middleware.js';
import '../types/express.d.ts';

const res = {} as Response;

describe('runMiddleware', () => {
	test('resolves when the middleware calls next()', async () => {
		const req = {} as Request;
		await runMiddleware(useCollection('directus_users'), req, res);
		expect(req.collection).toBe('directus_users');
	});

	test('rejects with the error the middleware passes to next(err)', async () => {
		const req = { method: 'PATCH', body: { keys: [1] } } as Request;
		await expect(runMiddleware(validateBatch('update'), req, res)).rejects.toBeInstanceOf(InvalidPayloadError);
	});

	test('rejects when the handler throws synchronously', async () => {
		await expect(
			runMiddleware(
				() => {
					throw new Error('boom');
				},
				{} as Request,
				res,
			),
		).rejects.toThrow('boom');
	});
});
