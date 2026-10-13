// Ported from directus/api/src/operations/transform/index.ts
import { defineOperationApi } from '../define-operation-api.js';
import { optionToObject } from '@backoffice/utils';

type Options = {
	json: string | Record<string, any>;
};

export default defineOperationApi<Options>({
	id: 'transform',

	handler: ({ json }) => {
		return optionToObject(json);
	},
});
