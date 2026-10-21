// Ported from directus/api/src/cli/commands/security/key.ts
import { randomUUID } from 'node:crypto';

export default async function generateKey(): Promise<void> {
	process.stdout.write(randomUUID());
	process.exit(0);
}
