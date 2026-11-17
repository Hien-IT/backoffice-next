import { expect, test } from 'vitest';
import enUS from './overlay/en-US.ts';
import viVN from './overlay/vi-VN.ts';
import enUSBase from './translations/en-US.json';

test('both overlays have the same keys and no empty value', () => {
	expect(Object.keys(viVN).sort()).toEqual(Object.keys(enUS).sort());

	for (const value of [...Object.values(enUS), ...Object.values(viVN)]) expect(value.trim()).not.toBe('');
});

// Feature 015 D-88 (owner): the three DR theme names are shown as Backoffice names on purpose.
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

// Spec 033 (contracts/web.md §6): the frame strings of the documentation area exist in both languages; the keys the
// generated translations already have (documentation, copy, page_not_found...) are used as they are, never shadowed.
test('033: the docs_* keys of the documentation area are in both overlays', () => {
	const keys = [
		'docs_guides',
		'docs_api',
		'docs_configuration',
		'docs_on_this_page',
		'docs_previous',
		'docs_next',
		'docs_pager',
		'docs_copied',
		'docs_copy_failed',
		'docs_copy_link',
		'docs_note',
		'docs_warning',
		'docs_load_error',
		'docs_retry',
		'docs_back_home',
		'docs_backoffice_only',
		'docs_variable',
		'docs_description',
		'docs_default',
		'docs_endpoints',
		'docs_query_parameters',
		'docs_path_parameters',
		'docs_request_body',
		'docs_responses',
		'docs_response_example',
		'docs_required',
		'docs_access_admin',
		'docs_access_authenticated',
		'docs_access_public',
		'docs_name',
		'docs_type',
		'docs_examples',
		'docs_response_structure',
	];

	for (const key of keys) {
		expect(enUS, key).toHaveProperty(key);
		expect(viVN, key).toHaveProperty(key);
	}

	for (const key of ['documentation', 'copy', 'page_not_found', 'page_not_found_body', 'loading']) {
		expect(enUSBase, key).toHaveProperty(key);
		expect(enUS, key).not.toHaveProperty(key);
	}
});
