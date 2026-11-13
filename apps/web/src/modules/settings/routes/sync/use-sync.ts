// Backoffice (spec 032, contracts/web.md): the state of the Environment Sync page. The source URL and token live in refs
// of the page only (no store, no localStorage, no sessionStorage) and are cleared when the page goes away (FR-003).
// Ticking follows the rows: a row ticks the rows it depends on; a delete ticks and locks the rows deleted with it.
import { computed, onBeforeUnmount, ref } from 'vue';
import { apiFetch } from '../../../../api/sdk.ts';
import {
	GROUP_KEYS,
	type GroupKey,
	type Phase,
	type StateFilter,
	type SyncDiff,
	type SyncResult,
	type SyncRow,
} from './types.ts';

export interface ApiErrorBody {
	errors?: { message?: string; extensions?: { code?: string; reason?: string } }[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
	const res = await apiFetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	const data = (await res.json().catch(() => ({}))) as { data?: T } & ApiErrorBody;
	if (!res.ok || data.data === undefined) {
		throw { errors: data.errors ?? [{ message: res.statusText, extensions: { code: 'INTERNAL_SERVER_ERROR' } }] };
	}

	return data.data;
}

/** A row the admin can tick: compared differently and not blocked. */
export const tickable = (row: SyncRow) => row.selectable && row.state !== 'same';

/** Rows the tick of a group selects: creates and updates only, never a delete (FR-016, FR-018). */
export const groupTickable = (row: SyncRow) => tickable(row) && row.state !== 'target_only';

export function useSync() {
	const url = ref('');
	const token = ref('');
	const groups = ref<GroupKey[]>([...GROUP_KEYS]);
	const phase = ref<Phase>('idle');
	const error = ref<ApiErrorBody | null>(null);
	const compared = ref<SyncDiff | null>(null);
	const selected = ref<Set<string>>(new Set());
	const result = ref<SyncResult | null>(null);
	const filter = ref<StateFilter>('changes');

	const rows = computed(() => compared.value?.rows ?? []);
	const byId = computed(() => new Map(rows.value.map((r) => [r.id, r])));

	/** Delete roots ticked now, by the rows they lock. */
	const lockedBy = computed(() => {
		const locks = new Map<string, string[]>();
		for (const id of selected.value) {
			const row = byId.value.get(id);
			if (row?.state !== 'target_only') continue;
			for (const child of row.cascade) locks.set(child, [...(locks.get(child) ?? []), id]);
		}

		return locks;
	});

	const isLocked = (row: SyncRow) => (lockedBy.value.get(row.id) ?? []).length > 0;

	function add(next: Set<string>, row: SyncRow) {
		if (next.has(row.id) || !tickable(row)) return;
		next.add(row.id);

		if (row.state === 'target_only') {
			for (const id of row.cascade) {
				const child = byId.value.get(id);
				if (child) add(next, child);
			}

			return;
		}

		for (const id of row.depends) {
			const dep = byId.value.get(id);
			if (dep) add(next, dep);
		}
	}

	function remove(next: Set<string>, row: SyncRow) {
		if (!next.has(row.id)) return;
		next.delete(row.id);

		// Rows that need this one go with it; the cascade of a delete is released.
		for (const other of rows.value) {
			if (next.has(other.id) && other.state !== 'target_only' && other.depends.includes(row.id)) remove(next, other);
		}

		if (row.state === 'target_only') {
			for (const id of row.cascade) {
				const stillLocked = [...next].some((root) => byId.value.get(root)?.cascade.includes(id) && root !== row.id);
				const child = byId.value.get(id);
				if (child && !stillLocked) remove(next, child);
			}
		}
	}

	function toggle(row: SyncRow, checked: boolean) {
		if (!tickable(row) || (!checked && isLocked(row))) return;
		const next = new Set(selected.value);
		(checked ? add : remove)(next, row);
		selected.value = next;
	}

	function toggleGroup(group: GroupKey, checked: boolean) {
		const next = new Set(selected.value);
		for (const row of rows.value) {
			if (row.group !== group || !groupTickable(row)) continue;
			if (checked) add(next, row);
			else if (!isLocked(row)) remove(next, row);
		}

		selected.value = next;
	}

	/** 'all', 'some' or 'none' of the creates and updates of a group are ticked. */
	function groupState(group: GroupKey): 'all' | 'some' | 'none' {
		const list = rows.value.filter((r) => r.group === group && groupTickable(r));
		const ticked = list.filter((r) => selected.value.has(r.id)).length;
		if (ticked === 0) return 'none';
		return ticked === list.length ? 'all' : 'some';
	}

	const visible = (row: SyncRow) => {
		if (filter.value === 'all') return true;
		if (filter.value === 'changes') return row.state !== 'same';
		return row.state === filter.value;
	};

	const selectedRows = computed(() => rows.value.filter((r) => selected.value.has(r.id)));

	async function compare() {
		const previous = phase.value === 'idle' ? 'idle' : 'compared';
		phase.value = 'comparing';
		error.value = null;

		try {
			compared.value = await post<SyncDiff>('/backoffice/sync/diff', {
				url: url.value,
				token: token.value,
				groups: groups.value,
			});

			selected.value = new Set();
			result.value = null;
			phase.value = 'compared';
		} catch (e) {
			error.value = e as ApiErrorBody;
			phase.value = previous === 'compared' && compared.value ? 'compared' : 'idle';
		}
	}

	async function apply() {
		if (!compared.value) return;
		phase.value = 'applying';
		error.value = null;

		try {
			result.value = await post<SyncResult>('/backoffice/sync/apply', {
				url: url.value,
				token: token.value,
				hash: compared.value.hash,
				groups: compared.value.groups,
				selected: [...selected.value],
			});

			phase.value = 'done';
		} catch (e) {
			error.value = e as ApiErrorBody;
			phase.value = 'compared';
		}
	}

	function clearSecrets() {
		url.value = '';
		token.value = '';
	}

	onBeforeUnmount(clearSecrets);

	return {
		url,
		token,
		groups,
		phase,
		error,
		compared,
		rows,
		selected,
		selectedRows,
		result,
		filter,
		visible,
		isLocked,
		toggle,
		toggleGroup,
		groupState,
		compare,
		apply,
		clearSecrets,
	};
}

/** i18n key and params for a reason of the sync routes (contracts/api.md); undefined for any other error. */
export function reasonMessage(
	reason: string | undefined,
): { key: string; params?: Record<string, string> } | undefined {
	if (!reason) return undefined;

	const fixed: Record<string, string> = {
		'"url" must be an http or https URL without credentials': 'sync_error_url',
		'The source address is not allowed': 'sync_error_denied',
		'The source rejected the token': 'sync_error_token',
		'The source token does not belong to an admin': 'sync_error_not_admin',
		'The source does not support environment sync': 'sync_error_unsupported',
		'The comparison is out of date, compare again': 'sync_error_stale',
		'This change would remove your own admin access': 'sync_error_self_admin',
		'The source could not be reached': 'sync_error_unreachable',
		'The source timed out': 'sync_error_timeout',
		'The source redirected the request': 'sync_error_redirect',
		'The source returned an unexpected response': 'sync_error_response',
		'Another sync is being applied': 'sync_error_busy',
	};

	if (fixed[reason]) return { key: fixed[reason]! };

	const version = /^Version mismatch: source (\S+) (\S+), target (\S+)$/.exec(reason);
	if (version)
		return { key: 'sync_error_version', params: { app: version[1]!, source: version[2]!, target: version[3]! } };

	const migrations = /^Migration mismatch: (\d+) differ$/.exec(reason);
	if (migrations) return { key: 'sync_error_migrations', params: { count: migrations[1]! } };

	const vendor = /^Data model cannot be compared between (\S+) and (\S+)$/.exec(reason);
	if (vendor) return { key: 'sync_error_vendor', params: { source: vendor[1]!, target: vendor[2]! } };

	return undefined;
}
