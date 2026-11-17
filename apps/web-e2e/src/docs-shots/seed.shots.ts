// Spec 033: creates the sample data alone (`docs:shots -- seed.shots.ts`), to look at the screens before taking pictures.
import { expect, test } from './shot.js';

test('sample data', async ({ data }) => {
	expect(data.productIds.length).toBeGreaterThan(5);
});
