// Ported from directus/api/src/cli/commands/security/secret.ts
export default async function generateSecret(): Promise<void> {
	const { nanoid } = await import('nanoid');

	process.stdout.write(nanoid(32));
	process.exit(0);
}
