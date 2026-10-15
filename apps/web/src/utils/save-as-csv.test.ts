// Spec 014 FR-092, US6-2 (T010): "Download Page as CSV" gives the same bytes as the Directus app for the same page.
// The reference file was downloaded from the Directus app 11.17.4 (fixtures/interfaces/snapshot/expected.content.json
// `pageCsv`): bo_content, columns title, status, date_published, sorted by `sort`, archived items filtered out.
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import expectedCsv from '../../fixtures/interfaces/snapshot/expected.content.csv?raw';
import { replaceQueue } from '../api/sdk.ts';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFieldsStore } from '../stores/fields.ts';
import { useRelationsStore } from '../stores/relations.ts';
import { mockFixtureApi } from '../test-utils/fetch.ts';
import { loadSnapshot } from '../test-utils/fixtures.ts';
import { buildCSV, saveAsCSV } from './save-as-csv.ts';

const saveAs = vi.hoisted(() => vi.fn());
vi.mock('file-saver', () => ({ default: { saveAs } }));

const snapshot = loadSnapshot();

beforeEach(async () => {
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	mockFixtureApi(snapshot);
	await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
});

afterEach(() => vi.clearAllMocks());

const page = () =>
	snapshot.items['bo_content']!.filter((item) => item['status'] !== 'archived')
		.sort((a, b) => a['sort'] - b['sort'])
		.slice(0, 25);

test('the CSV of the current page equals the file of the Directus app byte for byte', async () => {
	const csv = await buildCSV('bo_content', ['title', 'status', 'date_published'], page() as never);

	expect(csv).toBe(expectedCsv.replace(/\n$/, ''));
});

test('nested fields get "A -> B" column names', async () => {
	const csv = await buildCSV('bo_content', ['author.first_name'], [{ author: { first_name: 'Ada' } }] as never);

	expect(csv.split('\n')[0]).toBe('"Author -> First Name"');
});

test('saveAsCSV saves <collection>-<yyyymmdd>.csv', async () => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-10-16T08:00:00'));

	await saveAsCSV('bo_content', ['title'], page().slice(0, 1) as never);

	expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'bo_content-20261016.csv');
	vi.useRealTimers();
});
