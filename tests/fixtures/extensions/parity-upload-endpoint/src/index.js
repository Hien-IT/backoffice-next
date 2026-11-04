// Parity fixture (specs/031 research R7): a sandboxed endpoint installed by uploading its npm-pack tarball. Its name
// is not one of the fixtures seeded into the shared storage, so the upload does not clash with a local extension.
import { log } from 'directus:api';

export default (router) => {
	router.get('/', async () => {
		log('parity-upload-endpoint: hello');
		return { status: 200, body: { ok: true, source: 'upload' } };
	});
};
