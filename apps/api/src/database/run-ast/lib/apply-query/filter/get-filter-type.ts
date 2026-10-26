// Ported from directus/api/src/database/run-ast/lib/apply-query/filter/get-filter-type.ts
import { InvalidQueryError } from '@backoffice/errors';
import type { FieldFunction, FieldOverview } from '@backoffice/types';
import { getFunctionsForType, getOutputTypeForFunction } from '@backoffice/utils';
import { parseFilterKey } from '../../../../../utils/parse-filter-key.js';
import { jsonFilterType, parseJsonFunction } from '../../../../helpers/fn/json/parse-function.js';

export function getFilterType(fields: Record<string, FieldOverview>, key: string, collection = 'unknown') {
	const { fieldName, functionName } = parseFilterKey(key);

	const field = fields[fieldName];

	if (!field) {
		throw new InvalidQueryError({ reason: `Invalid filter key "${key}" on "${collection}"` });
	}

	const { type } = field;

	if (functionName) {
		const availableFunctions: string[] = getFunctionsForType(type);

		if (!availableFunctions.includes(functionName)) {
			throw new InvalidQueryError({ reason: `Invalid filter key "${key}" on "${collection}"` });
		}

		// Backoffice (spec 023, FR-003): a json path filters with the operators of the chosen value type.
		if (functionName === 'json') {
			return { type: jsonFilterType(parseJsonFunction(key, { filter: true }).type!) };
		}

		const functionType = getOutputTypeForFunction(functionName as FieldFunction);

		return { type: functionType };
	}

	return { type, special: field.special };
}
