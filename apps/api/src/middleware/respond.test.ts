import { expect, test, vi } from 'vitest';
import { respond } from './respond.js';

function res(payload: unknown) {
	const r: any = { locals: { payload }, setHeader: vi.fn(), json: vi.fn(), end: vi.fn() };
	r.status = vi.fn(() => r);
	return r;
}

test('JSON payload, Buffer payload, no payload (204); always no-cache and Vary', () => {
	const json = res({ a: 1 });
	respond(json);
	expect(json.json).toHaveBeenCalledWith({ a: 1 });
	expect(json.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
	expect(json.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cache-Control');

	const buffer = res(Buffer.from('x'));
	respond(buffer);
	expect(buffer.end).toHaveBeenCalledWith(Buffer.from('x'));

	const empty = res(undefined);
	respond(empty);
	expect(empty.status).toHaveBeenCalledWith(204);
});
