// Parity fixture for D-139 (specs/020): Express 4 idioms that differ on Express 5. One route per item; the path syntax
// item lives in its own extension because an Express 5 router throws on it while the extension registers.
export default {
	id: 'parity-endpoint-express4',
	handler: (router) => {
		// (2) removed APIs
		router.get('/param', (req, res) => res.json({ id: req.param('id') }));
		router.get('/send-status', (_req, res) => res.send(201));
		// (3) req.query assignment
		router.get('/query-assign', (req, res) => {
			req.query = { replaced: true };
			res.json(req.query);
		});
		// (4) req.host and req.body without a body parser on this route
		router.get('/host', (req, res) => res.json({ host: req.host }));
		// (5) a rejected async handler
		router.get('/async-reject', async () => {
			throw new Error('rejected');
		});
		// (6) urlencoded body
		router.post('/form', (req, res) => res.json({ body: req.body ?? null }));
	},
};
