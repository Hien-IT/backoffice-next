// Ported from directus/packages/extensions-registry/src/schemas/registry-version-response.ts
import { z } from 'zod';

export const RegistryVersionResponse = z.object({
	version: z.string(),
});

export type RegistryVersionResponse = z.infer<typeof RegistryVersionResponse>;
