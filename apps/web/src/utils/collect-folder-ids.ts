// Ported from directus/app/src/utils/collect-folder-ids.ts
import type { Folder } from '../composables/use-folders.ts';

export function collectAllFolderIds(allFolders: Folder[], rootIds: string[]): string[] {
	const result = new Set<string>(rootIds);
	let changed = true;

	while (changed) {
		changed = false;

		for (const folder of allFolders) {
			if (folder.parent && result.has(folder.parent) && !result.has(folder.id)) {
				result.add(folder.id);
				changed = true;
			}
		}
	}

	return [...result];
}
