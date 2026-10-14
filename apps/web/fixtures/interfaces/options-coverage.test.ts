// T091 (SC-003): every option key of every registered interface and display (directus-registry.json: union over the
// option contexts; `list` and `map` keys read by hand) has at least one test named `option:<id>.<key>` under src/.
// Display keys count only in tests under src/displays/ and interface keys only elsewhere, since `boolean`,
// `datetime` and `translations` are both.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import registry from './directus-registry.json';

/** Expected interface ids that are not registered, with the reason (as in registry.test.ts). */
const NOT_INSTALLED: Record<string, string> = {
	'input-rich-text-html': 'TinyMCE is not installed (owner decision pending)',
};

type Entry = { optionKeys: string[]; optionKeysByContext?: { keys: string[] }[] };

function keysOf(entries: Record<string, Entry>, kind: string): string[] {
	return Object.entries(entries)
		.filter(([id]) => !(kind === 'interface' && id in NOT_INSTALLED))
		.flatMap(([id, entry]) =>
			[...new Set([...entry.optionKeys, ...(entry.optionKeysByContext ?? []).flatMap(({ keys }) => keys)])].map(
				(key) => `${id}.${key}`,
			),
		)
		.sort();
}

const src = join(import.meta.dirname, '../../src');

/** `<id>.<key>` of every `option:<id>.<key>` in a test or describe name, split by where the test file lives. */
function namedKeys() {
	const found = { interface: new Set<string>(), display: new Set<string>() };
	// it / test / describe, with modifiers (`.skip`, `.runIf(...)`), then the quoted name.
	const testName = /\b(?:it|test|describe)(?:\.\w+(?:\([^)]*\))?)*\(\s*(['"`])([\s\S]*?)\1/g;

	for (const file of readdirSync(src, { recursive: true, encoding: 'utf8' })) {
		if (!file.endsWith('.test.ts')) continue;
		const kind = file.startsWith(`displays/`) ? 'display' : 'interface';

		for (const [, , name] of readFileSync(join(src, file), 'utf8').matchAll(testName)) {
			for (const [, key] of name!.matchAll(/option:([\w-]+\.\w+)/g)) found[kind].add(key!);
		}
	}

	return found;
}

const named = namedKeys();

describe('SC-003: every option key has a test named option:<id>.<key>', () => {
	test.each([
		['interface', keysOf(registry.interfaces as Record<string, Entry>, 'interface')],
		['display', keysOf(registry.displays as Record<string, Entry>, 'display')],
	] as const)('%s option keys', (kind, keys) => {
		const missing = keys.filter((key) => !named[kind].has(key));

		expect(missing, `${kind} option keys without an option:<id>.<key> test:\n${missing.join('\n')}`).toEqual([]);
	});

	test('every option:<id>.<key> test name points at a real option key', () => {
		const unknown = [
			...[...named.interface].filter(
				(key) => !keysOf(registry.interfaces as Record<string, Entry>, 'interface').includes(key),
			),
			...[...named.display].filter(
				(key) => !keysOf(registry.displays as Record<string, Entry>, 'display').includes(key),
			),
		];

		expect(unknown).toEqual([]);
	});

	test('the not installed interfaces are expected ids', () => {
		expect(Object.keys(NOT_INSTALLED).filter((id) => !(id in registry.interfaces))).toEqual([]);
	});
});
