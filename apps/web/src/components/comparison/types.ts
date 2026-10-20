// Ported from directus/app/src/views/private/components/comparison/types.ts
// Backoffice: `Activity` (directus/app/src/types/activity.ts, not ported) is reduced to the two fields used here.
import type { ContentVersion, User } from '@directus/types';
import type { Revision } from '../../types/revisions.ts';

export type VersionComparisonResponse = {
	outdated: boolean;
	mainHash: string;
	current: Record<string, any>;
	main: Record<string, any>;
};

export type NormalizedDate = {
	raw: string | null;
	formatted: string | null;
	dateObject: Date | null;
};

export type NormalizedItem = {
	id: string | number | undefined;
	displayName: string;
	date: NormalizedDate;
	user: string | User | null | undefined;
	collection?: string;
	item?: string | number;
};

export type NormalizedComparisonData = {
	base: NormalizedItem;
	incoming: NormalizedItem;
	selectableDeltas: NormalizedItem[];
	revisionFields?: Set<string> | undefined;
	comparisonType: 'version' | 'revision';
	outdated: boolean;
	mainHash: string;
	currentVersion: ContentVersion | null;
	initialSelectedDeltaId: number | string | null;
	fieldsWithDifferences: string[];
};

export type NormalizedComparison = {
	outdated: boolean;
	mainHash: string;
	incoming: Record<string, any>;
	base: Record<string, any>;
};

export type ComparisonData = {
	base: Record<string, any>;
	incoming: Record<string, any>;
	mainVersionMeta?: { timestamp: string; user: Revision['activity']['user'] | null } | undefined;
	selectableDeltas?: Revision[] | ContentVersion[];
	revisionFields?: Set<string>;
	comparisonType: 'version' | 'revision';
	outdated?: boolean;
	mainHash?: string;
	currentVersion?: ContentVersion | null;
	initialSelectedDeltaId?: number | string | undefined;
	previousRevision?: Revision | null;
	/** Backoffice: base and incoming before the rich text diff markup, restored instead of the highlighted HTML. */
	raw?: { base: Record<string, any>; incoming: Record<string, any> };
};
