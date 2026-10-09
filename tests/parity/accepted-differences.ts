// Accepted differences from Directus 11.17.4 (FR-101). Every `id` must exist in the "Khác biệt so với
// Directus" table of specs/<feature>-*/spec.md; temporary entries carry the feature that removes them.

export type Matcher = string | number | boolean | null | RegExp | { absent: true } | { any: true };

export type AcceptedDifference = {
	id: string;
	/** Spec that introduced the entry, e.g. '001'; ids are unique within that spec only. */
	feature: string;
	/** Feature number that removes a temporary difference ("Gỡ khi" column). */
	removeAt?: string;
	/** 'doc': outside HTTP responses (logs, packages, migrations, startup); the comparer ignores it. */
	kind: 'http' | 'doc';
	endpoints?: string[];
	location?: { status: true } | { header: string } | { jsonPointer: string };
	directus?: Matcher;
	backoffice?: Matcher;
	reason: string;
};

export const acceptedDifferences: AcceptedDifference[] = [
	{
		id: 'D-01',
		feature: '001',
		kind: 'http',
		endpoints: ['*'],
		location: { header: 'x-powered-by' },
		directus: 'Directus',
		backoffice: 'Backoffice',
		reason: 'Rebranding (Principle IX).',
	},
];
