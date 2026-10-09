// Ported from directus/tests/blackbox/common/get-dbs-to-test.ts
export const allVendors = [
	'postgres',
	'postgres10',
	'mysql',
	'mysql5',
	'maria',
	'mssql',
	'oracle',
	'cockroachdb',
	'sqlite3',
] as const;

export type Vendor = (typeof allVendors)[number];

/** Vendors to test, from TEST_DB (comma separated). Parity runs one vendor per environment. */
export function getDbsToTest(testDb = process.env['TEST_DB']): Vendor[] {
	const vendors = (testDb?.split(',').map((v) => v.trim()) as Vendor[] | undefined) ?? ['postgres'];

	for (const vendor of vendors) {
		if (allVendors.includes(vendor) === false) {
			throw new Error(`No e2e testing capabilities for vendor "${vendor}".`);
		}
	}

	return vendors;
}
