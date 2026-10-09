import { expect, test } from 'vitest';
import { useMetrics } from './index.js';

test('metrics are disabled until US5 ports them', () => {
	expect(useMetrics()).toBeUndefined();
});
