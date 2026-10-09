// Golden table measured on the directus/directus:11.17.4 image (specs/001-platform-foundation/contracts/config.md
// §2–§4). If the port ever reads configuration differently from Directus, these tests fail.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEnv } from './create-env.js';

let dir: string;

function file(name: string, content: string): string {
	const path = join(dir, name);
	writeFileSync(path, content);
	return path;
}

/** Runs createEnv with exactly these process variables (insertion order kept) and an optional config file. */
function env(processEnv: Record<string, string>, configPath?: string) {
	vi.unstubAllEnvs();

	for (const key of Object.keys(process.env)) {
		if (/^(SECRET|PORT|X|CONFIG_PATH|KEY_[A-Z]+)(_FILE)?$/.test(key)) vi.stubEnv(key, undefined);
	}

	vi.stubEnv('CONFIG_PATH', configPath ?? join(dir, 'missing.env'));
	for (const [key, value] of Object.entries(processEnv)) vi.stubEnv(key, value);

	return createEnv();
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'env-compat-'));
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('§1 sources and precedence', () => {
	test('the config file overrides a process variable of the same name', () => {
		expect(env({ PORT: '2222' }, file('a.env', 'PORT=1111\n'))['PORT']).toBe('1111');
	});

	test('a missing CONFIG_PATH file is ignored', () => {
		expect(env({ PORT: '3333' })['PORT']).toBe('3333');
	});

	test('values are cast by name: TYPE_MAP makes PORT a string', () => {
		expect(env({})['PORT']).toBe('8055');
		// LOG_LEVEL has no default in DEFAULTS: the logger falls back to 'info' (logger/index.ts).
		expect(env({})['LOG_LEVEL']).toBeUndefined();
		expect(env({})['ROOT_REDIRECT']).toBe('./admin');
	});
});

describe('§2 X and X_FILE', () => {
	test('in a .env file, the key that appears later wins', () => {
		const secret = file('secret.txt', 'from-file');
		expect(env({}, file('a.env', `SECRET_FILE=${secret}\nSECRET=plain\n`))['SECRET']).toBe('plain');
		expect(env({}, file('b.env', `SECRET=plain\nSECRET_FILE=${secret}\n`))['SECRET']).toBe('from-file');
	});

	test('in the process env, the key that appears later wins too', () => {
		const secret = file('secret.txt', 'from-file');
		expect(env({ SECRET_FILE: secret, SECRET: 'plain' })['SECRET']).toBe('plain');
		expect(env({ SECRET: 'plain', SECRET_FILE: secret })['SECRET']).toBe('from-file');
	});

	test('X_FILE for a non-Directus X is kept as is', () => {
		const result = env({ X_FILE: file('x.txt', 'x') });
		expect(result['X_FILE']).toBe(join(dir, 'x.txt'));
		expect(result).not.toHaveProperty('X');
	});

	test('a cast prefix on X_FILE applies to the file content', () => {
		expect(env({ PORT_FILE: `string:${file('port.txt', '4444')}` })['PORT']).toBe('4444');
	});

	test('an unreadable X_FILE stops with the raw value in the message', () => {
		expect(() => env({ SECRET_FILE: 'string:/cfg/missing' })).toThrow(
			'Failed to read value from file "string:/cfg/missing", defined in environment variable "SECRET_FILE".',
		);
	});
});

describe('§3 casting', () => {
	test.each([
		['number:abc', Number.NaN],
		['boolean:xyz', false],
		['json:{bad', '{bad'],
		['array:a,,b', ['a', 'b']],
		['string:123', '123'],
		['0123', '0123'],
		['true', true],
		['12', 12],
		['a,b', ['a', 'b']],
	])('%s', (raw, expected) => {
		expect(env({ KEY_TEST: raw })['KEY_TEST']).toEqual(expected);
	});

	test('regex: with invalid syntax throws a SyntaxError', () => {
		expect(() => env({ KEY_TEST: 'regex:(' })).toThrow(
			new SyntaxError('Invalid regular expression: /(/: Unterminated group'),
		);
	});
});

describe('§4 config file errors', () => {
	test('malformed JSON stops with the original SyntaxError', () => {
		expect(() => env({}, file('a.json', '{bad'))).toThrow(SyntaxError);
	});

	test('malformed YAML stops with the js-yaml error', () => {
		expect(() => env({}, file('a.yaml', 'a: [1,\n'))).toThrow(/YAMLException|unexpected end of the stream/);
	});

	test('empty YAML stops', () => {
		expect(() => env({}, file('a.yml', ''))).toThrow('YAML configuration file does not contain an object');
	});

	test('a JSON array stops', () => {
		expect(() => env({}, file('a.json', '[1]'))).toThrow('JSON configuration file does not contain an object');
	});

	test('a .js export that is neither a function nor an object stops', () => {
		expect(() => env({}, file('a.cjs', 'module.exports = 5;'))).toThrow(
			'Invalid JS configuration file export type. Requires one of "function", "object", received: "undefined"',
		);
	});

	test('a .js function export is called with process.env', () => {
		const result = env(
			{ KEY_BASE: 'b' },
			file('fn.cjs', 'module.exports = (env) => ({ PORT: 5555, KEY_SEEN: env.KEY_BASE });'),
		);
		expect(result['PORT']).toBe('5555');
		expect(result['KEY_SEEN']).toBe('b');
	});

	test('a .js object export is used as is', () => {
		expect(env({}, file('obj.cjs', 'module.exports = { PORT: 6666 };'))['PORT']).toBe('6666');
	});

	test('JSON and YAML values are read', () => {
		expect(env({}, file('c.json', '{"PORT": 7777}'))['PORT']).toBe('7777');
		expect(env({}, file('c.yaml', 'PORT: 8888\n'))['PORT']).toBe('8888');
	});
});
