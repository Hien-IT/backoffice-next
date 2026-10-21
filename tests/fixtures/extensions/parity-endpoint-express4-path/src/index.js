// Parity fixture for D-139 item (1): Express 4 path syntax (optional parameter, unnamed wildcard).
export default {
	id: 'parity-endpoint-express4-path',
	handler: (router) => {
		router.get('/optional/:id?', (req, res) => res.json({ id: req.params.id ?? null }));
		router.get('/wild/*', (req, res) => res.json({ rest: req.params[0] ?? null }));
	},
};
