// Parity fixture (specs/020 data-model §9): an endpoint extension that uses the request and the services context.
export default {
	id: 'parity-endpoint-demo',
	handler: (router, { services, getSchema }) => {
		router.get('/', (req, res) => {
			res.json({ ok: true, user: req.accountability?.user ?? null, admin: req.accountability?.admin ?? false });
		});

		router.post('/echo', (req, res) => {
			res.json({ body: req.body ?? null, query: req.query });
		});

		router.get('/items', async (req, res, next) => {
			try {
				const service = new services.ItemsService('bo_ext_items', {
					schema: await getSchema(),
					accountability: req.accountability,
				});

				const items = await service.readByQuery({ fields: ['id', 'title'], sort: ['id'], limit: -1 });
				res.json({ count: items.length });
			} catch (error) {
				next(error);
			}
		});
	},
};
