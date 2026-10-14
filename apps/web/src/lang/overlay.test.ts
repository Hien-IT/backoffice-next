import { expect, test } from 'vitest';
import enUS from './overlay/en-US.ts';
import viVN from './overlay/vi-VN.ts';
import enUSBase from './translations/en-US.json';

test('both overlays have the same keys and no empty value', () => {
	expect(Object.keys(viVN).sort()).toEqual(Object.keys(enUS).sort());

	for (const value of [...Object.values(enUS), ...Object.values(viVN)]) expect(value.trim()).not.toBe('');
});

test('overlay keys do not shadow a Directus key', () => {
	for (const key of Object.keys(enUS)) expect(enUSBase).not.toHaveProperty(key);
});
