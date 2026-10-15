// Feature 015 (FR-021, data-model §3): the store of running uploads, as directus/app/src/stores/files.ts.
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, test } from 'vitest';
import { useFilesStore } from './files.ts';

beforeEach(() => {
	setActivePinia(createPinia());
});

test('an upload is active between start and finish', () => {
	const store = useFilesStore();
	const upload = store.upload();

	expect(store.isAnyUploadActive).toBe(false);

	upload.start(3);
	expect(store.isAnyUploadActive).toBe(true);
	expect(upload.uploading.value).toBe(true);
	expect(upload.numberOfFiles.value).toBe(3);

	upload.progress.value = 40;
	upload.done.value = 1;
	expect(upload.progress.value).toBe(40);
	expect(upload.done.value).toBe(1);

	upload.finish();
	expect(store.isAnyUploadActive).toBe(false);
	expect(upload.progress.value).toBe(0);
});

test('several uploads stay active until the last one finishes; writes before start are ignored', () => {
	const store = useFilesStore();
	const first = store.upload();
	const second = store.upload();

	first.progress.value = 50;
	expect(first.progress.value).toBe(0);

	first.start(1);
	second.start(2);
	first.finish();
	expect(store.isAnyUploadActive).toBe(true);
	second.finish();
	expect(store.isAnyUploadActive).toBe(false);
});
