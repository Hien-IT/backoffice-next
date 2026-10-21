// Parity fixture (specs/020 data-model §9): a sandboxed endpoint using the request, log and sleep scopes. `/memory`
// aborts the process by design (FR-025); only the dedicated test calls it.
import { log, request, sleep } from 'directus:api';

export default (router) => {
	router.get('/', async () => {
		log('parity-endpoint-sandbox: hello');
		await sleep(1);
		return { status: 200, body: { ok: true } };
	});

	router.get('/fetch', async () => {
		const response = await request('http://files-fixtures/hello.txt');
		return { status: 200, body: { status: response.status, data: response.data } };
	});

	router.get('/outside', async () => {
		try {
			await request('http://example.invalid/');
			return { status: 200, body: { error: null } };
		} catch (error) {
			return { status: 200, body: { error: String(error?.message ?? error) } };
		}
	});

	router.get('/post', async () => {
		try {
			await request('http://files-fixtures/hello.txt', { method: 'POST' });
			return { status: 200, body: { error: null } };
		} catch (error) {
			return { status: 200, body: { error: String(error?.message ?? error) } };
		}
	});

	router.get('/slow', () => {
		const end = Date.now() + 5000;
		while (Date.now() < end) {
			// busy loop past EXTENSIONS_SANDBOX_TIMEOUT
		}

		return { status: 200, body: { done: true } };
	});

	router.get('/memory', () => {
		const chunks = [];
		for (;;) chunks.push(new Array(1e6).fill('x'));
	});
};
