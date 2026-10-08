import { expect, test } from 'vitest';
import * as node from './node/index.js';
import * as shared from './shared/index.js';

test('shared entry exports the helpers feature 001 uses', () => {
	for (const name of [
		'toArray',
		'toBoolean',
		'isObject',
		'parseJSON',
		'defaults',
		'isIn',
		'getRelation',
		'getRelationType',
		'REDACTED_TEXT',
	]) {
		expect(shared).toHaveProperty(name);
	}
});

test('node entry exports the helpers feature 001 uses', () => {
	for (const name of ['getNodeEnv', 'ipInNetworks', 'requireYaml', 'IpBlocklist']) {
		expect(node).toHaveProperty(name);
	}
});
