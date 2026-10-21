import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compare, moduleExports } from './extract-service-signatures.mjs';

test('the services handed to extensions match Directus, apart from D-141', () => {
	assert.deepEqual(compare(), []);
});

test('reads classes through export * and named re-exports, public methods only', () => {
	const dir = mkdtempSync(join(tmpdir(), 'service-signatures-'));

	writeFileSync(join(dir, 'index.ts'), "export * from './a.js';\nexport { B as C } from './b.js';\n");
	writeFileSync(
		join(dir, 'a.ts'),
		'export class A { constructor(x: number, y: number) {} run() {} private hide() {} protected p() {} static s() {} }',
	);
	writeFileSync(join(dir, 'b.ts'), 'export class B { get value() { return 1; } }\nexport function helper() {}');

	assert.deepEqual(moduleExports(join(dir, 'index.ts')), {
		A: { kind: 'class', arity: 2, methods: ['run'] },
		C: { kind: 'class', arity: null, methods: ['value'] },
	});
});

test('reports a missing class, method and constructor arity', () => {
	const directus = {
		A: { kind: 'class', arity: 1, methods: ['run', 'stop'] },
		B: { kind: 'class', arity: 1, methods: [] },
		WebSocketService: { kind: 'class', arity: 0, methods: [] },
	};

	const ours = { A: { kind: 'class', arity: 2, methods: ['run'] } };

	assert.deepEqual(compare(directus, ours), [
		'A: constructor takes 2 parameter(s), Directus 1',
		'A: missing method(s) stop',
		'B: missing',
	]);
});
