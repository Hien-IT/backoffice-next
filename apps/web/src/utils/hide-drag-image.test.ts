// Ported from directus/app/src/utils/hide-drag-image.test.ts
import { expect, test, vi } from 'vitest';
import { hideDragImage } from './hide-drag-image.ts';

test('Sets drag image to empty image', () => {
	const dataTransfer = {
		setDragImage: vi.fn() as any,
	} as DataTransfer;

	hideDragImage(dataTransfer);

	expect(dataTransfer.setDragImage).toHaveBeenCalledWith(new Image(), 0, 0);
});
