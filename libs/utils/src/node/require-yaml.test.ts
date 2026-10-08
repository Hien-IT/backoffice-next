import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { requireYaml } from './require-yaml.js';

test('reads and parses a YAML file', () => {
	const file = join(mkdtempSync(join(tmpdir(), 'yaml-')), 'a.yaml');
	writeFileSync(file, 'PORT: 3000\nLIST:\n  - a\n');
	expect(requireYaml(file)).toEqual({ PORT: 3000, LIST: ['a'] });
});
