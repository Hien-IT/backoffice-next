// Ported from directus/app/src/utils/parse-filter.test.ts
// Backoffice: a real pinia with the user set on the store instead of @pinia/testing (not a dependency).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUserStore } from '../../../stores/user.ts';
import { parseFilter } from './parse-filter.ts';

beforeEach(() => {
	setActivePinia(createPinia());

	useUserStore().currentUser = {
		id: '1',
		first_name: 'Kay',
		role: {
			id: '1',
			name: 'admin',
		},
		roles: [{ id: '1' }, { id: '2' }],
		// Custom nested user field
		org: { name: 'Directus' },
	} as any;
});

describe('parse-filter', () => {
	it('Should return filter with populated variables', () => {
		const filter = {
			// Static field
			user: { _eq: 'Kay' },
			// Dynamic fields
			role: { _in: ['$CURRENT_ROLE', '2'] },
			roles: { _in: ['$CURRENT_ROLES'] },
			orgName: { _eq: '$CURRENT_USER.org.name' },
		};

		const parsedFilter = parseFilter(filter);

		expect(parsedFilter).toEqual({
			_and: [
				{ user: { _eq: 'Kay' } },
				{ role: { _in: ['1', '2'] } },
				{ roles: { _in: ['1', '2'] } },
				{ orgName: { _eq: 'Directus' } },
			],
		});
	});

	// Backoffice: no signed-in user (or a share user) returns the filter as is.
	it('returns the filter unchanged without a signed-in user', () => {
		useUserStore().currentUser = null;
		expect(parseFilter({ a: { _eq: '$CURRENT_USER' } })).toEqual({ a: { _eq: '$CURRENT_USER' } });
		expect(parseFilter(null)).toEqual({});
	});
});
