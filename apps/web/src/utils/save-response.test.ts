// Feature 015 (FR-004, FR-014): zip downloads take the Content-Disposition name, else the fallback; errors reject.
import fileSaver from 'file-saver';
import { afterEach, expect, test, vi } from 'vitest';
import { saveResponse } from './save-response.ts';

vi.mock('file-saver', () => ({ default: { saveAs: vi.fn() } }));

afterEach(() => {
	vi.mocked(fileSaver.saveAs).mockReset();
});

test('uses the Content-Disposition file name', async () => {
	await saveResponse(
		new Response('zip', { headers: { 'Content-Disposition': 'attachment; filename="folder-a.zip"' } }),
		'x.zip',
	);

	expect(vi.mocked(fileSaver.saveAs).mock.calls[0]![1]).toBe('folder-a.zip');
});

test('falls back to the given name', async () => {
	await saveResponse(new Response('zip'), 'folder-unknown-1.zip');

	expect(vi.mocked(fileSaver.saveAs).mock.calls[0]![1]).toBe('folder-unknown-1.zip');
});

test('a failed answer rejects with errors and status', async () => {
	const response = new Response(JSON.stringify({ errors: [{ message: 'No files' }] }), { status: 400 });

	await expect(saveResponse(response, 'x.zip')).rejects.toEqual({
		errors: [{ message: 'No files' }],
		response: { status: 400 },
	});
	expect(fileSaver.saveAs).not.toHaveBeenCalled();
});
