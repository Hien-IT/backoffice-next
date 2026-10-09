import { startServer } from './server.js';
import { runStartupChecks } from './startup/run-startup-checks.js';

// A configuration error thrown here is printed by Node, which exits with code 1 (contracts/startup.md row 1).
await runStartupChecks();
await startServer();
