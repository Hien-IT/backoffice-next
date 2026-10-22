import { expect, test } from 'vitest';
import { formColumnClass } from './form-column.ts';

test('the centred column is the form card: 44.25rem or 64rem of fields plus 3.125rem of padding and border', () => {
	expect(formColumnClass([{ meta: { width: 'half' } }, { meta: null }])).toBe('mx-auto w-full max-w-[47.375rem]');
	expect(formColumnClass([{ meta: { width: 'fill' } }])).toBe('mx-auto w-full max-w-[67.125rem]');
});
