// Backoffice: the `start` action. DR' cli/index.ts calls startServer of server.ts directly; here it runs the same
// steps as src/main.ts (contracts/startup.md of 001) and imports server.js only when `start` runs, so the other commands
// never load its import-time side effects (spec 021 FR-042, research R1, R2).
import { runStartupChecks } from '../../startup/run-startup-checks.js';
import { logUnhandledRejections } from '../../unhandled-rejection.js';

export default async function start(): Promise<void> {
	logUnhandledRejections();
	await runStartupChecks();

	const { startServer } = await import('../../server.js');
	await startServer();
}
