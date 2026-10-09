// FR-080, contracts/startup.md §2–§3: SIGTERM lets a running request finish within SERVER_SHUTDOWN_TIMEOUT,
// cuts it after, and the process ends by the signal itself (exit code 143 through a shell).
import { connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import getPort from 'get-port';
import { afterEach, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './run-api.js';

const [vendor] = getDbsToTest();
let api: RunningApi | undefined;

afterEach(async () => {
	if (api) await stopApi(api);
	api = undefined;
});

/** Sends the headers of a JSON POST and keeps the body open; returns a way to finish it and the raw response. */
function slowRequest(port: number) {
	const socket = connect(port, '127.0.0.1');
	let response = '';
	socket.on('data', (chunk) => (response += chunk));
	const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()));
	const body = '{"a":1}';
	socket.write(
		`POST /nope HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n{"a"`,
	);
	return { finish: () => socket.write(body.slice(4)), response: () => response, closed };
}

async function start(timeout: number) {
	const port = await getPort();
	api = runApi({ ...hostDbEnv(vendor!), PORT: String(port), SERVER_SHUTDOWN_TIMEOUT: String(timeout) });
	expect(await waitForPing(api, port), api.output()).toBe(true);
	return port;
}

test(
	'a request in flight completes before SERVER_SHUTDOWN_TIMEOUT; the process ends by SIGTERM',
	{ timeout: 30_000 },
	async () => {
		const port = await start(3000);
		const req = slowRequest(port);
		await sleep(200);

		api!.child.kill('SIGTERM');
		await sleep(300);
		req.finish();
		await req.closed;

		expect(req.response()).toMatch(/^HTTP\/1\.1 404 Not Found/);
		expect(req.response()).toContain('ROUTE_NOT_FOUND');

		const { code, signal } = await api!.exited;
		expect(signal).toBe('SIGTERM');
		expect(code).toBe(null);
		expect(api!.output()).toContain('Shutting down...');
		expect(api!.output()).toContain('Database connections destroyed');
		expect(api!.output()).toContain('Backoffice shut down OK. Bye bye!');
	},
);

test('a request still open after SERVER_SHUTDOWN_TIMEOUT is cut', { timeout: 30_000 }, async () => {
	const port = await start(500);
	const req = slowRequest(port);
	await sleep(200);

	api!.child.kill('SIGTERM');
	await req.closed;

	expect(req.response()).toBe('');
	expect((await api!.exited).signal).toBe('SIGTERM');
});
