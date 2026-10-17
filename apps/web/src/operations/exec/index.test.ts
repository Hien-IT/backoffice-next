// Ported from directus/app/src/operations/exec/index.test.ts
import { describe, expect, it } from 'vitest';
import config from './index.ts';

describe('Overview', () => {
	it('Renders empty array', () => {
		// Backoffice: no pinia or crypto stub needed, the overview reads nothing.
		expect(typeof config.overview === 'function' && config.overview({}, { flow: {} as never })).toEqual([]);
	});
});
