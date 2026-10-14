// Ported from directus/api/src/services/graphql/utils/process-error.ts
import { type BackofficeError, isBackofficeError } from '@backoffice/errors';
import type { Accountability } from '@backoffice/types';
import type { GraphQLError, GraphQLFormattedError } from 'graphql';
import { useLogger } from '../../../logger/index.js';

const processError = (
	accountability: Accountability | null,
	error: Readonly<GraphQLError & { originalError: GraphQLError | BackofficeError | Error | undefined }>,
): GraphQLFormattedError => {
	const logger = useLogger();

	logger.error(error);

	let originalError = error.originalError;

	if (originalError && 'originalError' in originalError) {
		originalError = originalError.originalError;
	}

	if (isBackofficeError(originalError)) {
		return {
			message: originalError.message,
			extensions: {
				code: originalError.code,
				...(originalError.extensions ?? {}),
			},
			...(error.locations && { locations: error.locations }),
			...(error.path && { path: error.path }),
		};
	} else {
		if (accountability?.admin === true) {
			const graphqlFormattedError: {
				-readonly [key in keyof GraphQLFormattedError]: GraphQLFormattedError[key];
			} = {
				message: error.message,
				extensions: {
					code: 'INTERNAL_SERVER_ERROR',
				},
				...(error.locations && { locations: error.locations }),
				...(error.path && { path: error.path }),
			};

			return graphqlFormattedError;
		} else {
			return {
				message: 'An unexpected error occurred.',
				extensions: {
					code: 'INTERNAL_SERVER_ERROR',
				},
			};
		}
	}
};

export default processError;
