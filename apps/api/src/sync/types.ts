// Backoffice (spec 032, D-214): environment sync. Shared types of the routes under /backoffice/sync (data-model.md).
import type { Snapshot } from '@backoffice/types';

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

export type Row = Record<string, unknown>;

/** What an instance reports at GET /backoffice/sync; both sides must match before any config is read (FR-005). */
export interface SyncInfo {
	backoffice: string;
	directus: string;
	vendor: string;
	migrations: { directus: string[]; backoffice: string[] };
}

export interface SyncExtension {
	/** Row id of directus_extensions on that side (random per instance, never compared; used to write the target). */
	id?: string;
	name: string;
	bundle: string | null;
	enabled: boolean;
}

/** Config of the groups asked for, read by readState() on the source and on the target alike (research R1). */
export interface SyncState {
	schema?: Omit<Snapshot, 'systemFields'>;
	flows?: Row[];
	access?: { roles: Row[]; policies: Row[]; links: Row[]; permissions: Row[]; bo_permissions: Row[] };
	settings?: Row | null;
	translations?: Row[];
	presets?: Row[];
	dashboards?: Row[];
	indexes?: Row[];
	folders?: Row[];
	extensions?: SyncExtension[];
}

export type RowState = 'same' | 'changed' | 'source_only' | 'target_only';

export interface SyncChange {
	path: string;
	source: unknown;
	target: unknown;
}

export interface SyncImpact {
	items?: number;
	users?: number;
	files?: number;
	permissions?: number;
	active?: boolean;
}

export interface SyncRow {
	/** `${group}/${kind}:${key}`, unique within one comparison. */
	id: string;
	group: GroupKey;
	kind: string;
	key: string;
	label: string;
	state: RowState;
	changes?: SyncChange[];
	source?: Row;
	target?: Row;
	/** Rows that must be applied with this one while they are not `same`. */
	depends: string[];
	/** target_only rows deleted with this one when it is deleted (FR-020, data-model "Xóa kèm"). */
	cascade: string[];
	selectable: boolean;
	/** i18n key when not selectable. */
	reason?: string;
	impact?: SyncImpact;
}

export interface SyncIndexResult {
	collection: string;
	name: string;
	action: 'create' | 'delete';
	status: 'creating' | 'done' | 'failed';
	error?: string;
}

export interface SyncResult {
	created: Partial<Record<GroupKey, number>>;
	updated: Partial<Record<GroupKey, number>>;
	deleted: Partial<Record<GroupKey, number>>;
	deletedLabels: string[];
	indexes: SyncIndexResult[];
	/** Steps after the commit that failed (cache clear, flow reload, extension reload); the data stays written (FR-025). */
	warnings: string[];
}
