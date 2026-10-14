import { expect, test } from 'vitest';
import { readableMimeType } from './readable-mime-type.ts';

test('returns the readable name or extension of a mime type', () => {
	expect(readableMimeType('image/png')).toBe('PNG');
	expect(readableMimeType('image/png', true)).toBe('png');
	expect(readableMimeType('nope/nope')).toBeNull();
	expect(readableMimeType('nope/nope', true)).toBeNull();
});
