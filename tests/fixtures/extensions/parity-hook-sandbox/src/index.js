// Parity fixture (specs/020 data-model §9): a sandboxed hook; the sandbox passes the payload only.
import { log } from 'directus:api';

export default ({ filter, action }) => {
	filter('bo_ext_items.items.create', (payload) => {
		if (payload && payload.title === 'sandbox') return { ...payload, title: 'sandbox-filtered' };
		return payload;
	});

	action('bo_ext_items.items.create', () => {
		log('parity-hook-sandbox: item created');
	});
};
