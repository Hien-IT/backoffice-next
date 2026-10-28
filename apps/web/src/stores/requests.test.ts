// Backoffice: DR has no test for stores/requests.ts. The 3.5 s timer of a request clears it in the store it started
// in without making that pinia the active one (CI 40553204014 ListM2M flake: the timer of an earlier test switched the
// stores of the test running 3.5 s later).
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { afterEach, expect, test, vi } from 'vitest';
import { RUNNING_LIMIT_MS, useRequestsStore } from './requests.ts';

afterEach(() => vi.useRealTimers());

test('a request counts until it ends', () => {
	setActivePinia(createPinia());
	const requests = useRequestsStore();

	const id = requests.startRequest();
	expect(requests.queueHasItems).toBe(true);

	requests.endRequest(id);
	expect(requests.queueHasItems).toBe(false);
});

test('the 3.5 s timeout clears the request and keeps the active pinia of the moment', () => {
	vi.useFakeTimers();
	setActivePinia(createPinia());
	const requests = useRequestsStore();
	requests.startRequest();

	const next = createPinia();
	setActivePinia(next);
	vi.advanceTimersByTime(3500);

	// The active pinia first: reading a getter of an options store makes its pinia the active one too.
	expect(getActivePinia()).toBe(next);
	expect(requests.queue.size).toBe(0);
});

// Owner 2026-10-28 (D-173): the loading favicon follows `running`, which keeps a request past 3.5 s until it ends.
test('running keeps a request after 3.5 s until it ends, at most RUNNING_LIMIT_MS', () => {
	vi.useFakeTimers();
	setActivePinia(createPinia());
	const requests = useRequestsStore();

	const id = requests.startRequest();
	vi.advanceTimersByTime(3500);
	expect(requests.queueHasItems).toBe(false);
	expect(requests.runningHasItems).toBe(true);
	requests.endRequest(id);
	expect(requests.runningHasItems).toBe(false);

	requests.startRequest();
	vi.advanceTimersByTime(RUNNING_LIMIT_MS);
	expect(requests.runningHasItems).toBe(false);
});
