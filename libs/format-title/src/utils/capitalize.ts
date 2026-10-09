// Ported from directus/packages/format-title/src/utils/capitalize.ts
export function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.substring(1);
}
