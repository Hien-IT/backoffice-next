// Backoffice (spec 030, D-210): the `trgm` kind next to unique/foreign/index; the rule itself is the DR one.
import { expect, test } from 'vitest';
import { getDefaultIndexName } from './get-default-index-name.js';

test('joins the collection, the fields and the kind', () => {
	expect(getDefaultIndexName('unique', 'passenger_auth_identities', ['provider', 'provider_subject'])).toBe(
		'passenger_auth_identities_provider_provider_subject_unique',
	);
	expect(getDefaultIndexName('index', 'articles', 'title')).toBe('articles_title_index');
	expect(getDefaultIndexName('trgm', 'articles', 'title')).toBe('articles_title_trgm');
});

test('cuts a long name to maxLength with a hash before the kind', () => {
	const name = getDefaultIndexName('trgm', 'a'.repeat(50), ['b'.repeat(30)], { maxLength: 63 });
	expect(name).toHaveLength(63);
	expect(name.endsWith('_trgm')).toBe(true);
});
