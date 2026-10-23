import type { LoggerService } from '@nestjs/common';
import { useLogger } from './index.js';

/**
 * Nest's internal logger, routed to pino. Only warn/error/fatal are forwarded: DR has no
 * equivalent of Nest's startup and route-mapping logs (research R12).
 */
export class NestLoggerService implements LoggerService {
	log(): void {}

	debug(): void {}

	verbose(): void {}

	warn(message: unknown, ...rest: unknown[]): void {
		useLogger().warn(rest.length ? { context: rest } : {}, String(message));
	}

	error(message: unknown, ...rest: unknown[]): void {
		useLogger().error(rest.length ? { context: rest } : {}, String(message));
	}

	fatal(message: unknown, ...rest: unknown[]): void {
		useLogger().fatal(rest.length ? { context: rest } : {}, String(message));
	}
}
