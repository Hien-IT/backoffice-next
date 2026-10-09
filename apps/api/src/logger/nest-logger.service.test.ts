import { beforeEach, expect, test, vi } from 'vitest';
import { useLogger } from './index.js';
import { NestLoggerService } from './nest-logger.service.js';

vi.mock('./index.js');

const logger = { warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), info: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

test('forwards warn, error and fatal to pino', () => {
	const service = new NestLoggerService();
	service.warn('w');
	service.error('e', 'stack', 'Ctx');
	service.fatal('f');
	expect(logger.warn).toHaveBeenCalledWith({}, 'w');
	expect(logger.error).toHaveBeenCalledWith({ context: ['stack', 'Ctx'] }, 'e');
	expect(logger.fatal).toHaveBeenCalledWith({}, 'f');
});

test('drops log, debug and verbose (Directus has no such startup logs)', () => {
	const service = new NestLoggerService();
	service.log();
	service.debug();
	service.verbose();
	expect(logger.info).not.toHaveBeenCalled();
});
