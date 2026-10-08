// Ported from directus/packages/utils/shared/get-redacted-string.ts
export const getRedactedString = (key?: string) => `--redacted${key ? `:${key}` : ''}--`;

export const REDACTED_TEXT: string = getRedactedString();
