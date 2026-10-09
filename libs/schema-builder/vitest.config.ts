import { defineConfig } from 'vitest/config';

// Test-only tooling (builds SchemaOverview fixtures, never shipped in the API image): no coverage gate, like
// tests/parity. The 80% gate of Principle X applies to apps/api and the runtime libs.
export default defineConfig({ test: {} });
