import { expect, test } from 'vitest';
import * as types from './index.js';

test('exports the runtime values of the type package', () => {
	expect(types.DatabaseClients).toContain('postgres');
});
