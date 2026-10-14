// Ported from directus/app/src/utils/translate-object-values.ts
import { cloneDeep } from 'lodash-es';
import { i18n } from '../lang/index.ts';

// Backoffice: translate-literal.ts (one function) is inlined here.
function translateString(literal: any): string {
	let translated = literal;

	if (typeof literal === 'string' && literal.startsWith('$t:')) translated = i18n.global.t(literal.replace('$t:', ''));

	return translated;
}

export function translate<T extends Record<string, any> | string>(obj: T): T {
	if (typeof obj === 'string') {
		return obj.replaceAll(/(\$t:[a-zA-Z0-9.-]*)/gm, (match) => translateString(match)) as T;
	} else {
		const newObj = cloneDeep(obj);

		Object.entries(newObj).forEach(([key, val]) => {
			if (val && typeof val === 'object') (newObj as Record<string, any>)[key] = translate(val);
			if (val && typeof val === 'string') (newObj as Record<string, any>)[key] = translateString(val);
		});

		return newObj;
	}
}
