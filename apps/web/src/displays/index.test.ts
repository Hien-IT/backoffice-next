import { describe, expect, test } from 'vitest';
import { getDisplay, getDisplays, sortDisplays } from './index.ts';
import type { DisplayConfig } from './types.ts';

describe('displays', () => {
	test('sortDisplays() sorts by id', () => {
		const configs = ['raw', 'formatted-value', 'boolean', 'formatted-json-value'].map(
			(id) => ({ id }) as DisplayConfig,
		);
		expect(sortDisplays(configs).map((d) => d.id)).toEqual([
			'boolean',
			'formatted-json-value',
			'formatted-value',
			'raw',
		]);
	});

	test('getDisplay() finds a config by id and returns undefined otherwise', () => {
		for (const display of getDisplays()) expect(getDisplay(display.id)).toBe(display);
		expect(getDisplay('does-not-exist')).toBeUndefined();
		expect(getDisplay(undefined)).toBeUndefined();
	});
});
