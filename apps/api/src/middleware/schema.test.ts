import { expect, test, vi } from 'vitest';
import { getSchema } from '../schema/get-database-schema.js';
import schema from './schema.js';

vi.mock('../schema/get-database-schema.js');

const run = async (path: string) => {
	const req = { path } as any;
	const next = vi.fn();
	await schema(req, {} as any, next);
	return { req, next };
};

test('sets req.schema from getSchema()', async () => {
	const overview = { collections: {}, relations: [] };
	vi.mocked(getSchema).mockResolvedValue(overview);
	const { req, next } = await run('/server/info');
	expect(req.schema).toBe(overview);
	expect(next).toHaveBeenCalledWith();
});

test.each(['/server/health', '/server/health/', '/SERVER/Health'])('skips %s (D-13)', async (path) => {
	vi.mocked(getSchema).mockClear();
	const { req, next } = await run(path);
	expect(getSchema).not.toHaveBeenCalled();
	expect(req.schema).toBeUndefined();
	expect(next).toHaveBeenCalledWith();
});

test('does not skip paths that only start like health', async () => {
	vi.mocked(getSchema).mockResolvedValue({ collections: {}, relations: [] });
	vi.mocked(getSchema).mockClear();
	await run('/server/healthz');
	expect(getSchema).toHaveBeenCalled();
});

test('passes errors to next()', async () => {
	const error = new Error('down');
	vi.mocked(getSchema).mockRejectedValue(error);
	const { next } = await run('/server/info');
	expect(next).toHaveBeenCalledWith(error);
});
