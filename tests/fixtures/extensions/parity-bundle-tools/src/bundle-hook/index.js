// Parity fixture (specs/020 data-model §9): the hook entry of a bundle.
export default ({ action }, { database }) => {
	action('bo_ext_items.items.update', async (meta) => {
		await database('bo_ext_log').insert({
			kind: 'bundle',
			event: 'items.update',
			payload: JSON.stringify({ keys: meta.keys }),
		});
	});
};
