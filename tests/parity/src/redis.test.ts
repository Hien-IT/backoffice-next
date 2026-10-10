import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { decodeMessage, expandKeys, parseMonitorLine } from './redis.js';

test('decodeMessage reads plain JSON', () => {
	expect(decodeMessage(Buffer.from('{"autoPurgeCache":false}'))).toEqual({ autoPurgeCache: false });
});

test('decodeMessage gunzips values that start with the gzip header (from 1000 bytes on)', () => {
	const schema = { schema: { collections: { a: { note: 'x'.repeat(2000) } }, relations: [] } };
	expect(decodeMessage(gzipSync(Buffer.from(JSON.stringify(schema))))).toEqual(schema);
});

test('decodeMessage: empty buffer is undefined, like @directus/memory', () => {
	expect(decodeMessage(Buffer.alloc(0))).toBeUndefined();
});

test('parseMonitorLine keeps the client address, the command and its key or channel', () => {
	expect(
		parseMonitorLine('1700000000.123456 [0 172.18.0.5:41234] "INCRBY" "directus:lock:schemaCache--preparing" "1"'),
	).toEqual({
		client: '172.18.0.5',
		command: 'incrby',
		key: 'directus:lock:schemaCache--preparing',
	});
	expect(parseMonitorLine('1.2 [0 10.0.0.2:5] "PUBLISH" "directus:bus:schemaChanged" "{\\"a\\":1}"')).toMatchObject({
		command: 'publish',
		key: 'directus:bus:schemaChanged',
	});
	expect(parseMonitorLine('1.2 [0 10.0.0.2:5] "EVALSHA" "abc" "1" "permissions:x" "2"')).toMatchObject({
		command: 'evalsha',
		key: 'permissions:x',
	});
	const unlink = parseMonitorLine('1.2 [0 10.0.0.2:5] "UNLINK" "p:b" "p:a"')!;
	expect(expandKeys(unlink)).toEqual(['unlink p:a', 'unlink p:b']);
	expect(parseMonitorLine('1.2 [0 10.0.0.2:5] "SCAN" "13" "MATCH" "p:*" "COUNT" "100"')).toMatchObject({ key: 'p:*' });
	expect(parseMonitorLine('1.2 [0 10.0.0.2:5] "PING"')).toEqual({ client: '10.0.0.2', command: 'ping', key: '' });
	expect(parseMonitorLine('OK')).toBeUndefined();
});
