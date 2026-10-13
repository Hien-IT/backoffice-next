// Ported from directus/api/src/operations/condition/index.ts
import { defineOperationApi } from '../define-operation-api.js';
import type { Filter } from '@backoffice/types';
import { parseFilter, validatePayload } from '@backoffice/utils';
import { FailedValidationError, joiValidationErrorItemToErrorExtensions } from '@backoffice/validation';

type Options = {
	filter: Filter;
};

export default defineOperationApi<Options>({
	id: 'condition',

	handler: ({ filter }, { data, accountability }) => {
		const parsedFilter = parseFilter(filter, accountability, undefined, true);

		if (!parsedFilter) {
			return null;
		}

		const errors = validatePayload(parsedFilter, data, { requireAll: true });

		if (errors.length > 0) {
			const validationErrors = errors
				.map((error) =>
					error.details.map((details) => new FailedValidationError(joiValidationErrorItemToErrorExtensions(details))),
				)
				.flat();

			throw validationErrors;
		} else {
			return null;
		}
	},
});
