import { expect, test, vi } from 'vitest';
import getDefaultValue from './get-default-value.js';

vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn: vi.fn() }) }));

const column = (data_type: string, default_value: unknown) => ({ data_type, default_value }) as any;

test.each([
	[column('varchar', null), null],
	[column('timestamp', '0000-00-00 00:00:00'), null],
	[column('varchar', 'abc'), 'abc'],
	[column('integer', '12'), 12],
	[column('boolean', 'true'), true],
	[column('boolean', 'false'), false],
	[column('json', '{"a":1}'), { a: 1 }],
	[column('json', '{bad'), '{bad'],
	// DR casts number-like defaults with Number(), even beyond 2^53.
	[column('bigint', '9007199254740993'), 9007199254740992],
	[column('integer', 'nextval()'), 'nextval()'],
])('%o → %o', (input, expected) => {
	expect(getDefaultValue(input)).toEqual(expected);
});
