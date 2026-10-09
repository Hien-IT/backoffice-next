import { expect, test, vi } from 'vitest';
import { SHUTDOWN_TASK_TIMEOUT, onServerShutdown, runShutdownTasks } from './shutdown.js';

test('runs tasks in order, once', async () => {
	const order: number[] = [];
	onServerShutdown(() => order.push(1));
	onServerShutdown(async () => order.push(2));
	await runShutdownTasks();
	await runShutdownTasks();
	expect(order).toEqual([1, 2]);
});

test('a failing or hanging task never blocks or fails the shutdown', async () => {
	vi.useFakeTimers();
	const after = vi.fn();
	onServerShutdown(() => Promise.reject(new Error('boom')));
	onServerShutdown(() => new Promise(() => undefined));
	onServerShutdown(after);
	const done = runShutdownTasks();
	await vi.advanceTimersByTimeAsync(SHUTDOWN_TASK_TIMEOUT * 2);
	await done;
	expect(after).toHaveBeenCalledOnce();
	vi.useRealTimers();
});
