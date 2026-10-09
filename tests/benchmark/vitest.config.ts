import { defineConfig } from 'vitest/config';

// Unit tests of the comparison rules only (no Docker). Test tooling: not under the 80% coverage gate.
export default defineConfig({ test: { include: ['src/*.test.ts'] } });
