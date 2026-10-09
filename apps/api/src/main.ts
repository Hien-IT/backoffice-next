import { runStartupChecks } from './startup/run-startup-checks.js';

// A configuration error thrown here is printed by Node, which exits with code 1 (contracts/startup.md row 1).
// The server module is loaded afterwards so the startup steps run in the contract order.
await runStartupChecks();

const { startServer } = await import('./server.js');
await startServer();
