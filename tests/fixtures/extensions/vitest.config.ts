import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['fixtures-build.test.ts'], testTimeout: 60_000 } });
