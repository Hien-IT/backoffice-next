import { expect, test } from 'vitest';
import { formColumnClass } from './form-column.ts';

test('the centred column is as wide as the form: 44.25rem, or 64rem with a fill field', () => {
	expect(formColumnClass([{ meta: { width: 'half' } }, { meta: null }])).toBe('mx-auto w-full max-w-[44.25rem]');
	expect(formColumnClass([{ meta: { width: 'fill' } }])).toBe('mx-auto w-full max-w-5xl');
});
