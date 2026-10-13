// Ported from directus/api/src/operations/sleep/index.ts
import { defineOperationApi } from '../define-operation-api.js';

type Options = {
	milliseconds: string | number;
};

export default defineOperationApi<Options>({
	id: 'sleep',

	handler: async ({ milliseconds }) => {
		await new Promise((resolve) => setTimeout(resolve, Number(milliseconds)));
	},
});
