// Ported from directus/tests/blackbox/setup/sequencer.ts (the `before` list, reduced to the seed file).
// Backoffice: 00-seed.test.ts runs first, then every other file in path order; no sequencer-data.json.
import { BaseSequencer, type TestSpecification } from 'vitest/node';

export default class SeedFirstSequencer extends BaseSequencer {
	override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
		const isSeed = (file: TestSpecification) => file.moduleId.endsWith('/00-seed.test.ts');
		const sorted = [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
		return [...sorted.filter(isSeed), ...sorted.filter((file) => !isSeed(file))];
	}
}
