// Ported from directus/app/src/utils/readable-mime-type/index.ts
import extensions from './readable-mime-type/extensions.json';
import types from './readable-mime-type/types.json';

export function readableMimeType(type: string, extension = false): string | null {
	if (extension) {
		return (extensions as any)[type] || null;
	}

	return (types as any)[type] || null;
}
