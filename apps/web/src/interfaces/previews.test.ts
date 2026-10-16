import { describe, expect, test } from 'vitest';
import { loadInterfacePreview } from './previews.ts';

describe('loadInterfacePreview', () => {
	test('returns the SVG of an interface, the header one from presentation-header, nothing for unknown ids', async () => {
		expect(await loadInterfacePreview('input')).toMatch(/^<svg[\s\S]*var\(--theme--primary\)/);
		expect(await loadInterfacePreview('header')).toMatch(/^<svg/);
		expect(await loadInterfacePreview('system-raw-editor')).toBeUndefined();
	});
});
