// Feature 015 (FR-010, data-model §2): the system filter of the file library, as directus/app/src/utils/get-folder-filter.ts.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getFolderFilter } from './get-folder-filter.ts';

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

const typeSet = { type: { _nnull: true } };

test('library root: files without a folder', () => {
	expect(getFolderFilter()).toEqual({ _and: [typeSet, { folder: { _null: true } }] });
});

test('a folder: files of that folder', () => {
	expect(getFolderFilter('f1')).toEqual({ _and: [typeSet, { folder: { _eq: 'f1' } }] });
});

test('all files: only the type filter, the folder is ignored', () => {
	expect(getFolderFilter('f1', 'all')).toEqual({ _and: [typeSet] });
});

test('my files: uploaded by the current user', () => {
	expect(getFolderFilter(undefined, 'mine', 'u1')).toEqual({ _and: [typeSet, { uploaded_by: { _eq: 'u1' } }] });
	expect(getFolderFilter(undefined, 'mine')).toEqual({ _and: [typeSet] });
});

test('recent files: uploaded in the last five days', () => {
	expect(getFolderFilter(undefined, 'recent')).toEqual({
		_and: [typeSet, { uploaded_on: { _gt: '2026-10-11T12:00:00.000Z' } }],
	});
});
