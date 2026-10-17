import { expect, test } from 'vitest';
import enUS from './overlay/en-US.ts';
import viVN from './overlay/vi-VN.ts';
import enUSBase from './translations/en-US.json';

test('both overlays have the same keys and no empty value', () => {
	expect(Object.keys(viVN).sort()).toEqual(Object.keys(enUS).sort());

	for (const value of [...Object.values(enUS), ...Object.values(viVN)]) expect(value.trim()).not.toBe('');
});

// Feature 015 D-88 (owner): the three Directus theme names are shown as Backoffice names on purpose.
const SHADOWED = ['theme_directus_default', 'theme_directus_minimal', 'theme_directus_colormatch'];

test('overlay keys do not shadow a Directus key, except the D-88 theme names', () => {
	for (const key of Object.keys(enUS)) {
		if (SHADOWED.includes(key)) expect(enUSBase).toHaveProperty(key);
		else expect(enUSBase).not.toHaveProperty(key);
	}
});

test('D-88: the theme names read "Backoffice ..." in both languages', () => {
	for (const overlay of [enUS, viVN] as Record<string, string>[]) {
		for (const key of SHADOWED) expect(overlay[key]).toMatch(/^Backoffice /);
	}
});

// Feature 017 (D-106, CHK008): the mail operation notice names the product in both languages.
test('D-106: the mail notice says Backoffice does not send email', () => {
	expect(enUS.operations_mail_not_sent_notice).toMatch(/^Backoffice does not send email\./);
	expect(viVN.operations_mail_not_sent_notice).toMatch(/^Backoffice không gửi email\./);
});
