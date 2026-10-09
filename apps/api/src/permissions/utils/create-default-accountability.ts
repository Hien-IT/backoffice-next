// Ported from directus/api/src/permissions/utils/create-default-accountability.ts
import type { Accountability } from '@backoffice/types';

export function createDefaultAccountability(overrides?: Partial<Accountability>): Accountability {
	return {
		role: null,
		user: null,
		roles: [],
		admin: false,
		app: false,
		ip: null,
		...overrides,
	};
}
