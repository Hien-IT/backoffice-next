// Ported from directus/tests/blackbox/common/common.seed.ts
// Backoffice (feature 006): the tests flow of Directus' setup (tests_flow_data, sequencer-data.json) is not ported, so
// the seed only deletes the collections of common.test.ts left by an earlier run.
import { expect, it } from 'vitest';
import { DeleteCollection } from './functions';
import vendors from './get-dbs-to-test';

export const collectionName = 'common_test_collection';
export const collectionNameM2O = 'common_test_collection_m2o';
export const collectionNameO2M = 'common_test_collection_o2m';

export const seedDBStructure = () => {
	it.each(vendors)('%s', async (vendor) => {
		try {
			// Delete existing collections
			await DeleteCollection(vendor, { collection: collectionNameO2M });
			await DeleteCollection(vendor, { collection: collectionNameM2O });
			await DeleteCollection(vendor, { collection: collectionName });
		} catch (error) {
			expect(error).toBeFalsy();
		}
	});
};
