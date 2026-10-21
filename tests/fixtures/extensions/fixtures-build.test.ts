// The committed dist/ of every fixture extension is what `directus-extension build` produces from src/ (T016).
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
// @ts-expect-error plain ESM script
import { buildFixture, listFixtures } from './scripts/build.mjs';

const out = mkdtempSync(join(tmpdir(), 'fixture-extensions-'));

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe.each(listFixtures() as string[])('%s', (name) => {
	test('dist matches a fresh build', async () => {
		const fresh = (await buildFixture(name, out)) as string;
		const committed = join(import.meta.dirname, name, 'dist');

		expect(readdirSync(fresh).sort()).toEqual(readdirSync(committed).sort());

		for (const file of readdirSync(fresh)) {
			expect(readFileSync(join(fresh, file), 'utf8'), file).toBe(readFileSync(join(committed, file), 'utf8'));
		}
	}, 60_000);
});
