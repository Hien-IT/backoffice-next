// DR has no test for tools.ts: the selection, the files permission rule and the alignment tunes (FR-062).
import ImageTool from '@editorjs/image';
import { describe, expect, test } from 'vitest';
import { Alignment } from './alignment.ts';
import { AttachesTool, ImageTool as DirectusImageTool } from './plugins.ts';
import getTools, { type UploaderConfig } from './tools.ts';

const uploader: UploaderConfig = {
	baseURL: 'http://localhost/',
	setFileHandler: () => undefined,
	getUploadFieldElement: () => undefined,
};

describe('getTools', () => {
	test('only the selected known tools, with the Directus settings', () => {
		const tools = getTools(uploader, ['header', 'image', 'attaches', 'unknown', 'paragraph'], true) as Record<
			string,
			any
		>;

		expect(Object.keys(tools)).toEqual(['header', 'image', 'attaches', 'paragraph']);
		expect(tools['header']).toMatchObject({ inlineToolbar: true });
		expect(tools['image'].class).toBe(DirectusImageTool);
		expect(tools['image'].class.prototype).toBeInstanceOf(ImageTool);
		expect(tools['image'].config.uploader).toBe(uploader);
		expect(tools['attaches'].class).toBe(AttachesTool);
	});

	test('image and attaches are left out without access to directus_files', () => {
		const tools = getTools(uploader, ['image', 'attaches', 'code'], false);

		expect(Object.keys(tools)).toEqual(['code']);
	});

	test('alignment adds its tune to paragraph, header and quote', () => {
		const tools = getTools(uploader, ['paragraph', 'header', 'quote', 'code', 'alignment'], false) as Record<
			string,
			any
		>;

		expect(tools['alignment'].class).toBe(Alignment);
		expect(tools['paragraph'].tunes).toEqual(['alignment']);
		expect(tools['header'].tunes).toEqual(['alignment']);
		expect(tools['quote'].tunes).toEqual(['alignment']);
		expect(tools['code'].tunes).toBeUndefined();

		expect(getTools(uploader, ['paragraph'], false)['paragraph']).not.toHaveProperty('tunes');
	});
});
