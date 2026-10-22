// Setup file of the `unit` project (owner 2026-10-23, GHSA-mrv2-3pqr-j5jr): DOMPurify >= 3.4.8 sanitizes nothing
// under happy-dom (it returns the input as is), while browsers and jsdom sanitize. The unit tests keep happy-dom and give
// DOMPurify a jsdom window instead: the default instance and every `DOMPurify(window)` the app makes run on it.
// @ts-expect-error jsdom ships no types; only `new JSDOM('').window` is used.
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';

vi.mock('dompurify', async (importOriginal) => {
	const { default: createDOMPurify } = await importOriginal<typeof import('dompurify')>();
	const { window } = new JSDOM('');
	const create = () => createDOMPurify(window as unknown as Window & typeof globalThis);

	return { default: Object.assign(create, create()) };
});
