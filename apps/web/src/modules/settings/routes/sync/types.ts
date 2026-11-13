// Backoffice (spec 032, data-model.md): the answers of POST /backoffice/sync/diff and /apply, as the page reads them.
export const GROUP_KEYS = [
	'schema',
	'flows',
	'access',
	'settings',
	'translations',
	'presets',
	'dashboards',
	'indexes',
	'folders',
	'extensions',
] as const;

export type GroupKey = (typeof GROUP_KEYS)[number];

export type RowState = 'same' | 'changed' | 'source_only' | 'target_only';

export type Row = Record<string, unknown>;

export interface SyncRow {
	id: string;
	group: GroupKey;
	kind: string;
	key: string;
	label: string;
	state: RowState;
	changes?: { path: string; source: unknown; target: unknown }[];
	source?: Row;
	target?: Row;
	depends: string[];
	cascade: string[];
	selectable: boolean;
	reason?: string;
	impact?: { items?: number; users?: number; files?: number; permissions?: number; active?: boolean };
}

export interface SyncInfo {
	backoffice: string;
	directus: string;
	vendor: string;
}

export interface SyncDiff {
	hash: string;
	source: SyncInfo;
	groups: GroupKey[];
	rows: SyncRow[];
}

export interface SyncResult {
	created: Partial<Record<GroupKey, number>>;
	updated: Partial<Record<GroupKey, number>>;
	deleted: Partial<Record<GroupKey, number>>;
	deletedLabels: string[];
	indexes: { collection: string; name: string; action: 'create' | 'delete'; status: string; error?: string }[];
	warnings: string[];
}

export type Phase = 'idle' | 'comparing' | 'compared' | 'applying' | 'done';

export type StateFilter = 'changes' | 'all' | 'changed' | 'source_only' | 'target_only';
