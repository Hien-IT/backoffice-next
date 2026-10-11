// Ported from directus/tests/blackbox/common/get-dbs-to-test.ts
// Backoffice: one vendor per parity environment, from TEST_DB like the other parity tests.
import { allVendors, getDbsToTest, type Vendor } from '../../../get-dbs-to-test.js';

export { allVendors, type Vendor };

const vendors = getDbsToTest();

export default vendors;
