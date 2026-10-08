import { expect, test } from 'vitest';
import * as pressure from './index.js';

test('exports the monitor and the express middleware', () => {
	expect(Object.keys(pressure).sort()).toEqual(['PressureMonitor', 'handlePressure']);
});
