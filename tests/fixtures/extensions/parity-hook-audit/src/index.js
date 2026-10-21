// Parity fixture (specs/020 data-model §9): filter, action, init, schedule and embed of a hook extension.
// Event names are only logged for requests sent with the `x-bo-ext-trace` header, so other suites are not affected.
import { AsyncLocalStorage } from 'node:async_hooks';

// One store per process: the init middleware is added once at startup, while a reload imports this module again.
const trace = (globalThis.__boExtTrace ??= new AsyncLocalStorage());

const TRACED_EVENTS = [
	'items.create',
	'items.update',
	'items.delete',
	'auth.login',
	'files.upload',
	'fields.create',
	'fields.delete',
];

export default ({ filter, action, init, schedule, embed }, { env, database }) => {
	const log = (kind, event, payload) =>
		database('bo_ext_log').insert({ kind, event, payload: JSON.stringify(payload ?? null) });

	init('middlewares.before', ({ app }) => {
		app.use((req, res, next) => {
			res.setHeader('x-bo-ext', '1');
			trace.run(req.headers['x-bo-ext-trace'] ?? null, next);
		});
	});

	init('routes.custom.before', ({ app }) => {
		app.use((_req, res, next) => {
			res.setHeader('x-bo-ext-custom', '1');
			next();
		});
	});

	filter('items.create', (payload, meta) => {
		if (meta.collection !== 'bo_ext_items') return payload;
		return { ...payload, audited: true };
	});

	for (const event of TRACED_EVENTS) {
		action(event, async (meta) => {
			const tag = trace.getStore();
			if (!tag) return;
			await log('event', event, {
				tag,
				collection: meta.collection ?? null,
				keys: meta.keys ?? (meta.key ? [meta.key] : null),
			});
		});
	}

	if (String(env['BO_EXT_SCHEDULE'] ?? '') === '1' || env['BO_EXT_SCHEDULE'] === true) {
		schedule('* * * * *', async () => {
			await log('tick', 'schedule', null);
		});
	}

	embed('head', '<!-- parity-hook-audit -->');
};
