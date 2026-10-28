// Backoffice (spec 025, FR-011): the export rules carried by the query and paired with the read permissions.
import type { Permission, Query } from '@backoffice/types';
import objectHash from 'object-hash';
import { expect, test } from 'vitest';
import { exportRulesOf, pairWithExportRules, setExportRules } from './export-rules.js';
import type { BackofficeRule } from './fetch-backoffice-access.js';

const published = { status: { _eq: 'published' } };
const own = { owner: { _eq: 'u1' } };

const read = (over: Partial<Permission>): Permission => ({
	policy: 'p1',
	collection: 'articles',
	action: 'read',
	permissions: null,
	validation: null,
	presets: null,
	fields: ['*'],
	...over,
});

test('the rules survive spreads of the query and stay out of its hash and JSON', () => {
	const rules: BackofficeRule[] = [{ filter: own, fields: ['id'], formats: ['csv'] }];
	const query: Query = { fields: ['id'] };
	setExportRules(query, rules);

	expect(exportRulesOf({ ...query, limit: 10 })).toBe(rules);
	expect(JSON.stringify(query)).toBe('{"fields":["id"]}');
	expect(objectHash(query)).toBe(objectHash({ fields: ['id'] }));
	expect(exportRulesOf({ fields: ['id'] })).toBeUndefined();
});

test('every read permission of the collection with every export rule: filters ANDed, fields intersected', () => {
	const permissions = [
		read({ permissions: published }),
		read({ policy: 'p2', fields: ['id', 'title'] }),
		read({ collection: 'authors' }),
	];

	const rules: BackofficeRule[] = [
		{ filter: own, fields: ['id', 'price'], formats: ['csv'] },
		{ filter: null, fields: ['*'], formats: ['csv'] },
		{ filter: null, fields: ['price'], formats: ['csv'] },
	];

	expect(pairWithExportRules(permissions, 'articles', rules)).toEqual([
		read({ permissions: { _and: [published, own] }, fields: ['id', 'price'] }),
		read({ permissions: published, fields: ['*'] }),
		read({ permissions: published, fields: ['price'] }),
		read({ policy: 'p2', permissions: own, fields: ['id'] }),
		read({ policy: 'p2', permissions: null, fields: ['id', 'title'] }),
		// p2 cannot read price: that pair is dropped.
	]);
});
