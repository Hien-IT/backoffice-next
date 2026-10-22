import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { mergeResults, paced, splitAmount } from './paced.ts';

let server: Server;
let url: string;
const arrivals: number[] = [];

beforeAll(async () => {
	server = createServer((_req, res) => {
		arrivals.push(performance.now());
		res.end('ok');
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

test('splitAmount spreads the remainder over the first instances', () => {
	expect(splitAmount(10, 4)).toEqual([3, 3, 2, 2]);
	expect(splitAmount(2, 4)).toEqual([1, 1, 0, 0]);
});

test('mergeResults sums the fields the suites read', () => {
	const r = (total: number, code: string) =>
		({
			requests: { total, average: total },
			errors: 1,
			timeouts: 0,
			non2xx: 2,
			statusCodeStats: { [code]: { count: total } },
		}) as never;

	expect(mergeResults([r(3, '200'), r(4, '200'), r(1, '500')])).toEqual({
		requests: { total: 8, average: 8 },
		errors: 3,
		timeouts: 0,
		non2xx: 6,
		statusCodeStats: { '200': { count: 7 }, '500': { count: 1 } },
	});
});

test('a rate arrives spread over the second, not as one burst', async () => {
	arrivals.length = 0;
	let responses = 0;

	const result = await new Promise<{ requests: { total: number } }>((resolve, reject) => {
		const instance = paced({ url, overallRate: 10, amount: 20 }, (err, res) => (err ? reject(err) : resolve(res)));
		instance.on('response', () => responses++);
	});

	expect(result.requests.total).toBe(20);
	expect(responses).toBe(20);

	// The first second: 10 requests about 100 ms apart (a burst would put them all within a few ms).
	const first = arrivals.slice(0, 10).map((t) => t - arrivals[0]!);
	expect(first[9]).toBeGreaterThan(700);
	const gaps = first.slice(1).map((t, i) => t - first[i]!);
	expect(Math.max(...gaps)).toBeLessThan(250);
});
