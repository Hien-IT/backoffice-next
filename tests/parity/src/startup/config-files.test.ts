// US1.3–US1.6, FR-011..FR-013, contracts/config.md §2–§4: the built API reads every config format Directus reads,
// and stops with the original error on a broken one.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import getPort from 'get-port';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { type RunningApi, hostDbEnv, runApi, stopApi, waitForPing } from './run-api.js';

const [vendor] = getDbsToTest();
const db = hostDbEnv(vendor!);

let dir: string;
let running: RunningApi[] = [];

function file(name: string, content: string): string {
	const path = join(dir, name);
	writeFileSync(path, content);
	return path;
}

function start(env: Record<string, string>, cwd?: string): RunningApi {
	const api = runApi(env, cwd);
	running.push(api);
	return api;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'config-files-'));
});

afterEach(async () => {
	await Promise.all(running.map(stopApi));
	running = [];
});

const dotenv = (values: Record<string, string>) =>
	Object.entries(values)
		.map(([k, v]) => `${k}=${v}`)
		.join('\n') + '\n';

describe('CONFIG_PATH formats', () => {
	test('.env in the working directory is read by default', async () => {
		const port = await getPort();
		file('.env', dotenv({ ...db, PORT: String(port) }));
		const api = start({}, dir);
		expect(await waitForPing(api, port), api.output()).toBe(true);
	});

	test.each([
		['.env', (v: Record<string, string>) => dotenv(v)],
		['.json', (v: Record<string, string>) => JSON.stringify(v)],
		[
			'.yaml',
			(v: Record<string, string>) =>
				Object.entries(v)
					.map(([k, x]) => `${k}: '${x}'`)
					.join('\n'),
		],
		[
			'.yml',
			(v: Record<string, string>) =>
				Object.entries(v)
					.map(([k, x]) => `${k}: '${x}'`)
					.join('\n'),
		],
		['.cjs', (v: Record<string, string>) => `module.exports = ${JSON.stringify(v)};`],
		['.js', (v: Record<string, string>) => `module.exports = function (env) { return ${JSON.stringify(v)}; };`],
	])('%s', async (ext, render) => {
		const port = await getPort();
		const path = file(`config${ext}`, render({ ...db, PORT: String(port) }));
		const api = start({ CONFIG_PATH: path });
		expect(await waitForPing(api, port), api.output()).toBe(true);
	});

	test('values in the file override the process environment', async () => {
		const port = await getPort();
		const path = file('c.env', dotenv({ ...db, PORT: String(port) }));
		const api = start({ CONFIG_PATH: path, PORT: '1' });
		expect(await waitForPing(api, port), api.output()).toBe(true);
	});

	test('a missing CONFIG_PATH file is ignored', async () => {
		const port = await getPort();
		const api = start({ ...db, CONFIG_PATH: join(dir, 'missing.env'), PORT: String(port) });
		expect(await waitForPing(api, port), api.output()).toBe(true);
	});
});

describe('X_FILE and cast prefixes', () => {
	test('SECRET_FILE and DB_PASSWORD_FILE are read from files; prefixed values are cast', async () => {
		const port = await getPort();
		const { DB_PASSWORD, ...rest } = db;

		const api = start({
			...rest,
			...(DB_PASSWORD ? { DB_PASSWORD_FILE: file('db-password', DB_PASSWORD) } : {}),
			SECRET_FILE: file('secret', 'a-secret-that-is-longer-than-32-bytes!!'),
			PORT: `string:${port}`,
			CACHE_ENABLED: 'boolean:false',
			MAX_PAYLOAD_SIZE: 'string:1mb',
		});

		expect(await waitForPing(api, port), api.output()).toBe(true);
		expect(api.output()).not.toContain('"SECRET" env variable is missing');
	});
});

describe('broken configuration stops with the original error and a non-zero exit code', () => {
	test.each([
		[
			'unreadable X_FILE',
			() => ({ SECRET_FILE: 'string:/cfg/missing' }),
			'Failed to read value from file "string:/cfg/missing", defined in environment variable "SECRET_FILE".',
		],
		['malformed JSON', () => ({ CONFIG_PATH: file('bad.json', '{bad') }), 'SyntaxError'],
		['malformed YAML', () => ({ CONFIG_PATH: file('bad.yaml', 'a: [1,\n') }), 'YAMLException'],
		[
			'JSON array',
			() => ({ CONFIG_PATH: file('arr.json', '[1]') }),
			'JSON configuration file does not contain an object',
		],
		[
			'.js export of the wrong type',
			() => ({ CONFIG_PATH: file('bad.cjs', 'module.exports = 5;') }),
			'Invalid JS configuration file export type. Requires one of "function", "object", received: "undefined"',
		],
		[
			'invalid regex: value',
			() => ({ KEY_REGEX_TEST: 'regex:(' }),
			'Invalid regular expression: /(/: Unterminated group',
		],
	])('%s', async (_label, env, message) => {
		const api = start({ ...db, ...env() });
		const { code } = await api.exited;
		expect(code).not.toBe(0);
		expect(api.output()).toContain(message);
	});
});
