// Backoffice: DR' image runs under pm2-runtime (directus/Dockerfile, `pm2-runtime start ecosystem.config.cjs`),
// whose process container logs an unhandled rejection on stderr and keeps the process running
// (pm2/lib/ProcessContainer.js, getUncaughtExceptionListener). Plain Node 22 would exit instead. The rejected bus
// publish of websocket/controllers/hooks.ts while Redis is down (spec R-10) then leaves both apps running.
export function logUnhandledRejections(): void {
	process.on('unhandledRejection', (reason: unknown) => {
		const error = reason instanceof Error && reason.stack ? reason.stack : reason;
		process.stderr.write(
			`You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection:\n${error}\n`,
		);
	});
}
