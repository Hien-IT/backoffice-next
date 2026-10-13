// Backoffice: tests that build the whole app (createApp) mock the FlowManager, which would otherwise read
// directus_flows from the database at startup (feature 009, plan risk 4).
import { vi } from 'vitest';

export function mockFlowManager() {
	const manager = {
		initialize: vi.fn(async () => undefined),
		unload: vi.fn(async () => undefined),
		reload: vi.fn(async () => undefined),
		runWebhookFlow: vi.fn(),
		runOperationFlow: vi.fn(),
		getFlow: vi.fn(),
	};

	return { getFlowManager: () => manager };
}
