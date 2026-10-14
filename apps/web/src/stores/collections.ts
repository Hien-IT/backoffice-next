// Ported from directus/app/src/stores/collections.ts
// Backoffice: only hydrate/dehydrate; feature 013+ ports the rest (D-45).
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';

export const useCollectionsStore = defineStore('collectionsStore', () => {
	const collections = ref<Record<string, any>[]>([]);

	async function hydrate() {
		collections.value = await sdk.request(requestEndpoint<Record<string, any>[]>('/collections', { method: 'GET' }));
	}

	async function dehydrate() {
		collections.value = [];
	}

	return { collections, hydrate, dehydrate };
});
