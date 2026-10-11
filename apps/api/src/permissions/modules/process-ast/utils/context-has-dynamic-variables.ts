// Ported from directus/api/src/permissions/modules/process-ast/utils/context-has-dynamic-variables.ts
import type { DynamicVariableContext } from '../../../utils/extract-required-dynamic-variable-context.js';

export function contextHasDynamicVariables(context: DynamicVariableContext): boolean {
	return Object.values(context).some((v: Set<string>) => v.size > 0);
}
