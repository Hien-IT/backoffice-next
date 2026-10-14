// Ported from directus/app/src/stores/relations.ts
// Backoffice: only hydrate/dehydrate; feature 013+ ports the rest (D-45).
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';

export const useRelationsStore = defineStore('relations', () => {
	const relations = ref<Record<string, any>[]>([]);

	async function hydrate() {
		relations.value = await sdk.request(requestEndpoint<Record<string, any>[]>('/relations', { method: 'GET' }));
	}

	async function dehydrate() {
		relations.value = [];
	}

	return { relations, hydrate, dehydrate };
});
