// Parity fixture (specs/020 data-model §9): a sandboxed operation.
import { log } from 'directus:api';

export default {
	id: 'parity-operation-sandbox',
	handler: (options) => {
		log('parity-operation-sandbox: run');
		return { echoed: options?.text ?? null };
	},
};
