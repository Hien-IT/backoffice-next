// Backoffice: stand-in for directus/api/src/utils/versioning/handle-version.ts (research R4 of spec 004). Content
// versions (/versions, D-09.6 of spec 001) come with feature 008; until then a read with `version` other than `main`
// fails instead of reading a version.
// ponytail: throws for every versioned read; feature 008 ports the real handleVersion and its VersionsService.
import type { PrimaryKey, Query, QueryOptions } from '@backoffice/types';

export async function handleVersion(
	_service: unknown,
	_key: PrimaryKey,
	_queryWithKey: Query,
	_opts?: QueryOptions,
): Promise<any> {
	throw new Error('versions are not available before feature 008');
}
