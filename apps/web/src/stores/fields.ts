// Ported from directus/app/src/stores/fields.ts
// Backoffice: only hydrate/dehydrate; feature 013+ ports the rest (D-45).
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { requestEndpoint, sdk } from '../api/sdk.ts';

export const useFieldsStore = defineStore('fieldsStore', () => {
	const fields = ref<Record<string, any>[]>([]);

	async function hydrate() {
		fields.value = await sdk.request(requestEndpoint<Record<string, any>[]>('/fields', { method: 'GET' }));
	}

	async function dehydrate() {
		fields.value = [];
	}

	return { fields, hydrate, dehydrate };
});
