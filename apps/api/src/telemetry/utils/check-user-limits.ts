// Ported from directus/api/src/telemetry/utils/check-user-limits.ts
import { useEnv } from '@backoffice/env';
import { LimitExceededError } from '@backoffice/errors';
import { type UserCount } from '../../utils/fetch-user-count/fetch-user-count.js';

/**
 * Ensure that user limits are not reached
 */
export async function checkUserLimits(userCounts: UserCount): Promise<void> {
	// Backoffice: read the configuration on call, not when the module loads (quy ước 001, research R15 of spec 003)
	const env = useEnv();

	if (userCounts.admin > Number(env['USERS_ADMIN_ACCESS_LIMIT'])) {
		throw new LimitExceededError({ category: 'Active Admin users' });
	}

	// Both app and admin users count against the app access limit
	if (userCounts.app + userCounts.admin > Number(env['USERS_APP_ACCESS_LIMIT'])) {
		throw new LimitExceededError({ category: 'Active App users' });
	}

	if (userCounts.api > Number(env['USERS_API_ACCESS_LIMIT'])) {
		throw new LimitExceededError({ category: 'Active API users' });
	}
}
