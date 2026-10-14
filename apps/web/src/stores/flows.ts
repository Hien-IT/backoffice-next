// Ported from directus/app/src/stores/flows.ts
// Backoffice: the AI tools hook is removed (D-54).
import type { FlowRaw } from '@directus/types';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchAll } from '../utils/fetch-all.ts';
import { usePermissionsStore } from './permissions.ts';

export const useFlowsStore = defineStore('flowsStore', () => {
	const flows = ref<FlowRaw[]>([]);

	return {
		flows,
		hydrate,
		dehydrate,
		getManualFlowsForCollection,
		isActiveFlow,
	};

	async function hydrate() {
		const { hasPermission } = usePermissionsStore();

		if (!hasPermission('directus_flows', 'read')) {
			flows.value = [];
		} else {
			try {
				flows.value = await fetchAll('/flows', {
					params: { fields: ['*', 'operations.*'] },
				});
			} catch {
				flows.value = [];
			}
		}
	}

	async function dehydrate() {
		flows.value = [];
	}

	function getManualFlowsForCollection(collection: string): FlowRaw[] {
		return flows.value.filter(
			(flow) =>
				flow.trigger === 'manual' && flow.status === 'active' && flow.options?.['collections']?.includes(collection),
		);
	}

	// Backoffice: isActiveFlow of directus/app/src/composables/use-flows.ts on the whole store, for the default
	// run-manual-flow injection of `header`/`presentation-links` when no screen provides one (R10).
	function isActiveFlow(flowId: string) {
		const flow = flows.value.find((flow) => flow.id === flowId);

		return flow?.status === 'active';
	}
});
