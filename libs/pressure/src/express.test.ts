import { expect, test, vi } from 'vitest';
import { handlePressure } from './express.js';
import { PressureMonitor } from './monitor.js';

vi.mock('./monitor.js');

function run(overloaded: boolean, options: Parameters<typeof handlePressure>[0] = {}) {
	vi.mocked(PressureMonitor).mockImplementation(() => ({ overloaded }) as unknown as PressureMonitor);
	const res = { header: vi.fn() };
	const next = vi.fn();
	handlePressure(options)({} as any, res as any, next);
	return { res, next };
}

test('passes through when not overloaded', () => {
	const { res, next } = run(false, { retryAfter: '10' });
	expect(next).toHaveBeenCalledWith();
	expect(res.header).not.toHaveBeenCalled();
});

test('calls next with the configured error and sets Retry-After when overloaded', () => {
	const error = new Error('busy');
	const { res, next } = run(true, { error, retryAfter: '10' });
	expect(res.header).toHaveBeenCalledWith('Retry-After', '10');
	expect(next).toHaveBeenCalledWith(error);
});

test('falls back to a default error without Retry-After', () => {
	const { res, next } = run(true);
	expect(res.header).not.toHaveBeenCalled();
	expect(next.mock.calls[0]![0]).toEqual(new Error('Pressure limit exceeded'));
});
