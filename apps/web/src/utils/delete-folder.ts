// Ported from directus/app/src/utils/delete-folder.ts
// Backoffice: requests go through the SDK (FR-001) instead of axios.
import { requestEndpoint, sdk } from '../api/sdk.ts';
import type { Folder } from '../composables/use-folders.ts';
import { collectAllFolderIds } from './collect-folder-ids.ts';

const getIds = async (path: string, filter: Record<string, unknown>): Promise<string[]> => {
	const data = await sdk.request(
		requestEndpoint<{ id: string }[]>(path, { method: 'GET', params: { filter, fields: ['id'], limit: -1 } }),
	);

	return data.map((item) => item.id);
};

export async function moveSingleFolder(folder: Folder): Promise<void> {
	const newParent = folder.parent;

	const [childFolderIds, childFileIds] = await Promise.all([
		getIds('/folders', { parent: { _eq: folder.id } }),
		getIds('/files', { folder: { _eq: folder.id } }),
	]);

	await Promise.all([
		childFolderIds.length > 0
			? sdk.request(
					requestEndpoint('/folders', { method: 'PATCH', body: { keys: childFolderIds, data: { parent: newParent } } }),
				)
			: Promise.resolve(),
		childFileIds.length > 0
			? sdk.request(
					requestEndpoint('/files', { method: 'PATCH', body: { keys: childFileIds, data: { folder: newParent } } }),
				)
			: Promise.resolve(),
	]);
}

export async function moveAndDelete(folders: Folder[]): Promise<void> {
	await Promise.all(folders.map(moveSingleFolder));
	await sdk.request(requestEndpoint('/folders', { method: 'DELETE', body: folders.map((f) => f.id) }));
}

export async function recursiveDelete(folders: Folder[], allFolders: Folder[]): Promise<void> {
	const allFolderIds = collectAllFolderIds(
		allFolders,
		folders.map((f) => f.id),
	);

	const allFolderIdSet = new Set(allFolderIds);

	const withParentInSet = allFolders
		.filter((f) => allFolderIdSet.has(f.id) && f.parent !== null && allFolderIdSet.has(f.parent!))
		.map((f) => f.id);

	if (withParentInSet.length > 0) {
		await sdk.request(
			requestEndpoint('/folders', { method: 'PATCH', body: { keys: withParentInSet, data: { parent: null } } }),
		);
	}

	const fileIds = await getIds('/files', { folder: { _in: allFolderIds } });

	if (fileIds.length > 0) {
		await sdk.request(requestEndpoint('/files', { method: 'DELETE', body: fileIds }));
	}

	await sdk.request(requestEndpoint('/folders', { method: 'DELETE', body: allFolderIds }));
}
