import { expect, test } from 'vitest';
import { displayCollectionKey, isUntranslatedKey } from './display-collection-key.ts';

test('system keys read backoffice_, user keys unchanged; untranslated note keys are detected', () => {
	expect(displayCollectionKey('directus_access')).toBe('backoffice_access');
	expect(displayCollectionKey('bo_content')).toBe('bo_content');
	expect(isUntranslatedKey('directus_collection.directus_deployment_runs')).toBe(true);
	expect(isUntranslatedKey('Comments for items')).toBe(false);
});
