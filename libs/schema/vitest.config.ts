import { createVitestConfig } from '../../vitest.shared.ts';

export default createVitestConfig({
	coverageThreshold: 80,
	// Server dialects need a live database: tests/parity runs every vendor against them (PR: postgres, mysql;
	// nightly: maria, mssql, oracle, cockroachdb). Unit coverage measures the SQLite dialect and the shared code.
	// See plan.md Complexity Tracking.
	coverageExclude: ['src/dialects/{postgres,cockroachdb,mysql,mssql,oracledb}.ts'],
});
