// Backoffice (spec 025, FR-022..FR-027, D-189.3): the rows of backoffice_permissions of the policy being edited, staged
// next to the o2m `permissions` of the policy form and written through /backoffice/permissions once the policy is
// saved (research R7). The policy page provides one staging; the matrix injects it (none: no import/export columns).
import type { Filter } from '@directus/types';
import { type InjectionKey, type Ref, computed, inject, ref } from 'vue';
import { requestEndpoint, sdk } from '../../../api/sdk.ts';
import type { BackofficeAction } from './app-permissions.ts';

export type BoPermission = {
	id?: number;
	policy: string | null;
	collection: string;
	action: BackofficeAction;
	permissions: Filter | null;
	validation: Filter | null;
	presets: Record<string, unknown> | null;
	fields: string[] | null;
	options: { formats?: string[] } | null;
};

export type BoDisplayItem = BoPermission & { $type?: 'created' | 'updated'; $index?: number };

export type BoPermissionsStaging = ReturnType<typeof createBoPermissionsStaging>;

export const BO_PERMISSIONS: InjectionKey<BoPermissionsStaging> = Symbol('bo-permissions');

const ENDPOINT = '/backoffice/permissions';

export function createBoPermissionsStaging(policy: Ref<string | null>) {
	const fetched = ref<BoPermission[]>([]);
	const created = ref<BoPermission[]>([]);
	const updated = ref<Record<number, BoPermission>>({});
	const deleted = ref<number[]>([]);

	const hasEdits = computed(
		() => created.value.length > 0 || Object.keys(updated.value).length > 0 || deleted.value.length > 0,
	);

	const displayItems = computed<BoDisplayItem[]>(() => [
		...fetched.value
			.filter((row) => !deleted.value.includes(row.id!))
			.map((row) => (updated.value[row.id!] ? { ...updated.value[row.id!]!, $type: 'updated' as const } : row)),
		...created.value.map((row, index) => ({ ...row, $type: 'created' as const, $index: index })),
	]);

	return { displayItems, hasEdits, fetch, create, update, remove, flush, reset };

	async function fetch() {
		if (!policy.value || policy.value === '+') {
			fetched.value = [];
			return;
		}

		fetched.value = await sdk.request<BoPermission[]>(
			requestEndpoint(ENDPOINT, { params: { filter: { policy: { _eq: policy.value } }, limit: -1, fields: '*' } }),
		);
	}

	function create(row: BoPermission) {
		created.value = [...created.value, clean(row)];
	}

	function update(item: BoDisplayItem) {
		if (item.$type === 'created') {
			created.value = created.value.map((row, index) => (index === item.$index ? clean(item) : row));
		} else if (item.id !== undefined) {
			updated.value = { ...updated.value, [item.id]: clean(item) };
		}
	}

	function remove(item: BoDisplayItem) {
		if (item.$type === 'created') {
			created.value = created.value.filter((_row, index) => index !== item.$index);
		} else if (item.id !== undefined) {
			const { [item.id]: _removed, ...rest } = updated.value;
			updated.value = rest;
			deleted.value = [...deleted.value, item.id];
		}
	}

	/** Writes the staged rows for `policyId` (a policy created by the same save has its id only now). */
	async function flush(policyId: string) {
		// Nothing staged (always so when the API is DR, FR-034): no request.
		if (!hasEdits.value) return;

		if (created.value.length > 0) {
			const rows = created.value.map((row) => ({ ...row, policy: policyId }));
			await sdk.request(requestEndpoint(ENDPOINT, { method: 'POST', body: rows }));
		}

		const updates = Object.values(updated.value);
		if (updates.length > 0) await sdk.request(requestEndpoint(ENDPOINT, { method: 'PATCH', body: updates }));

		if (deleted.value.length > 0) {
			await sdk.request(requestEndpoint(ENDPOINT, { method: 'DELETE', body: deleted.value }));
		}

		reset();
		await fetch();
	}

	function reset() {
		created.value = [];
		updated.value = {};
		deleted.value = [];
	}
}

export function useBoPermissions(): BoPermissionsStaging | null {
	return inject(BO_PERMISSIONS, null);
}

function clean(item: BoDisplayItem): BoPermission {
	const { $type: _type, $index: _index, ...row } = item;
	return row;
}
