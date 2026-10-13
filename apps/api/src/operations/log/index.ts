// Ported from directus/api/src/operations/log/index.ts
import { defineOperationApi } from '../define-operation-api.js';
import { optionToString } from '@backoffice/utils';
import { useLogger } from '../../logger/index.js';

type Options = {
	message: unknown;
};

export default defineOperationApi<Options>({
	id: 'log',

	handler: ({ message }) => {
		const logger = useLogger();

		logger.info(optionToString(message));
	},
});
