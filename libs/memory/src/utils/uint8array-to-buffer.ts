// Ported from directus/packages/memory/src/utils/uint8array-to-buffer.ts
import { Buffer } from 'node:buffer';

export const uint8ArrayToBuffer = (array: Uint8Array): Buffer<ArrayBuffer> => Buffer.from(array);
