// Ported from directus/tests/blackbox/setup/sequencer.ts and sequential-tests.ts (the `before` and `after` lists,
// reduced to the files of the port).
// Backoffice: 00-seed.test.ts runs first, then the `before` files in list order, every other file in path order, and
// the `after` files last in list order; no sequencer-data.json. Feature 006 adds the data model files: schema,
// collections and fields first (they replace the whole model), timezone and schema-cache last (other nodes).
import { BaseSequencer, type TestSpecification } from 'vitest/node';

const BEFORE = [
	'/00-seed.test.ts',
	'/common/common.test.ts',
	'/tests/db/routes/schema/schema.test.ts',
	'/tests/db/routes/collections/crud.test.ts',
	'/tests/db/routes/fields/change-fields.test.ts',
	'/tests/db/routes/fields/crud.test.ts',
];

const AFTER = [
	'/tests/db/schema/timezone/timezone.test.ts',
	'/tests/db/schema/timezone/timezone-changed-node-tz-america.test.ts',
	'/tests/db/schema/timezone/timezone-changed-node-tz-asia.test.ts',
	'/tests/db/routes/collections/schema-cache.test.ts',
];

export function order(moduleIds: string[]): string[] {
	const rank = (id: string) => {
		const before = BEFORE.findIndex((end) => id.endsWith(end));
		if (before !== -1) return before - BEFORE.length - 1;
		const after = AFTER.findIndex((end) => id.endsWith(end));
		return after === -1 ? 0 : after + 1;
	};

	return [...moduleIds].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export default class SeedFirstSequencer extends BaseSequencer {
	override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
		const ids = order(files.map((file) => file.moduleId));
		return [...files].sort((a, b) => ids.indexOf(a.moduleId) - ids.indexOf(b.moduleId));
	}
}
