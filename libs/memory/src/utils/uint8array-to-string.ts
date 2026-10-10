// Ported from directus/packages/memory/src/utils/uint8array-to-string.ts
const decoder = new TextDecoder();

/**
 * Convert a JS Uint8Array to a String
 */
export const uint8ArrayToString = (val: Uint8Array): string => decoder.decode(val);
