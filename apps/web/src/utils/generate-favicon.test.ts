import { describe, expect, test } from 'vitest';
import { generateFavicon } from './generate-favicon.ts';

const decode = (url: string) => atob(url.replace('data:image/svg+xml;base64,', ''));

describe('generateFavicon', () => {
	test('a circle in the project color with the Backoffice mark', () => {
		const url = generateFavicon('#336699');

		expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
		expect(decode(url)).toContain('fill: #336699');
		expect(decode(url)).toContain('<path');
		expect(decode(url)).not.toContain('Directus');
	});

	test('without the mark when the project has its own logo', () => {
		expect(decode(generateFavicon('#336699', false))).not.toContain('<path');
	});

	test('changes with the color', () => {
		expect(generateFavicon('#000000')).not.toBe(generateFavicon('#ffffff'));
	});
});
