import { describe, expect, test, vi } from 'vitest';
import { translate } from './translate-object-values.ts';

vi.mock('../lang/index.ts', () => ({
	i18n: { global: { t: (key: string) => `<${key}>` } },
}));

describe('translate', () => {
	test('translates $t: literals in strings and nested objects without changing the input', () => {
		const input = { name: '$t:title', nested: { list: ['$t:a.b', 'plain'] }, count: 1, empty: '' };

		expect(translate('Hello $t:user-name!')).toBe('Hello <user-name>!');
		expect(translate(input)).toEqual({ name: '<title>', nested: { list: ['<a.b>', 'plain'] }, count: 1, empty: '' });
		expect(input.name).toBe('$t:title');
	});
});
