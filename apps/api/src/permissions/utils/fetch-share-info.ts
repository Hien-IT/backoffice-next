// Ported from directus/api/src/permissions/utils/fetch-share-info.ts
import type { AbstractServiceOptions } from '@backoffice/types';
import { withCache } from './with-cache.js';

export interface ShareInfo {
	collection: string;
	item: string;
	role: string | null;
	user_created: {
		id: string;
		role: string;
	};
}

export const fetchShareInfo = withCache('share-info', _fetchShareInfo, (shareId) => ({ shareId }));

export async function _fetchShareInfo(shareId: string, context: AbstractServiceOptions): Promise<ShareInfo> {
	// Backoffice: SharesService comes with feature 010 (D-31 of spec 004); it does not override readOne, so a plain
	// ItemsService reads the same row.
	const { ItemsService } = await import('../../services/items.service.js');
	const sharesService = new ItemsService('directus_shares', context);

	return (await sharesService.readOne(shareId, {
		fields: ['collection', 'item', 'role', 'user_created.id', 'user_created.role'],
	})) as ShareInfo;
}
