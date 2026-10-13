// Feature 010 (research R10): the comparable form of system rows and the D-09.8 filter need no Docker.
import { expect, test } from 'vitest';
import { comparable, jwtPayload, withoutD098 } from './helpers.js';

test('ids become placeholders, times keep only whether they are set, generated values become markers', () => {
	const row = {
		id: '3f1c2d4e-0000-4000-8000-00000000000a',
		item: '12',
		password: '$argon2id$v=19$m=65536,t=3,p=4$abc$def',
		token: 'a'.repeat(32) + '-' + 'b'.repeat(31),
		filename_disk: '3f1c.csv',
		date_created: '2026-10-14T00:00:00Z',
		date_end: null,
		times_used: 1,
		nested: [{ share: '3f1c2d4e-0000-4000-8000-00000000000a', expires: '2026-10-21' }],
	};

	expect(comparable(row, { share: '3f1c2d4e-0000-4000-8000-00000000000a', item: 12 })).toEqual({
		id: '<share>',
		item: '<item>',
		password: '<argon2>',
		token: '<token>',
		filename_disk: '<filename_disk>',
		date_created: '<time>',
		date_end: null,
		times_used: 1,
		nested: [{ share: '<share>', expires: '<time>' }],
	});
});

test('a token that is not 64 characters and a string that only contains an id stay as they are', () => {
	expect(comparable({ token: 'short', note: 'x-12-y' }, { item: 12 })).toEqual({ token: 'short', note: 'x-12-y' });
});

test('jwtPayload drops iat, exp and session', () => {
	const body = Buffer.from(JSON.stringify({ share: 's', role: null, iat: 1, exp: 2, session: 't' })).toString(
		'base64url',
	);

	expect(jwtPayload(`h.${body}.s`)).toEqual({ share: 's', role: null });
});

test('withoutD098 drops D-09.8 and D-14 only', () => {
	expect(withoutD098.some((d) => d.id === 'D-09.8' || d.id === 'D-14')).toBe(false);
	expect(withoutD098.some((d) => d.id === 'D-01')).toBe(true);
});
