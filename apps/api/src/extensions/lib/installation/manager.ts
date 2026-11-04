// Ported from directus/api/src/extensions/lib/installation/manager.ts
// Backoffice (spec 031, D-212): the steps after the tarball stream is at hand are shared by the registry install and
// the upload of an npm-pack tarball (installFromStream); an upload goes to .upload/<id> (a folder DR never scans, so DR
// does not turn it into a registry extension), its errors are 400 with a reason instead of the 503 of the registry.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join } from 'path';
import type { ReadableStream } from 'stream/web';
import { useEnv } from '@backoffice/env';
import { ErrorCode, InvalidPayloadError, isBackofficeError, ServiceUnavailableError } from '@backoffice/errors';
import { EXTENSION_PKG_KEY, ExtensionManifest } from '@backoffice/extensions';
import { download, type DownloadOptions } from '../../registry/index.js';
import DriverLocal from '@backoffice/storage-driver-local';
import { move, remove } from 'fs-extra';
import Queue from 'p-queue';
import { extract } from 'tar';
import { useLogger } from '../../../logger/index.js';
import { getStorage } from '../../../storage/index.js';
import { getExtensionsPath } from '../get-extensions-path.js';

const env = useEnv();

/** Backoffice (spec 031): where a source keeps its packages, under EXTENSIONS_PATH (local and shared storage). */
export type InstalledSource = 'registry' | 'upload';

const SOURCE_FOLDER: Record<InstalledSource, string> = { registry: '.registry', upload: '.upload' };

/** Backoffice (spec 031): the hidden local folder of an upload before its row exists (the scan skips dot folders). */
const stagedName = (folder: string) => `.${folder}`;

/** Backoffice (spec 031): checks of an uploaded package, run on its manifest before anything leaves the temp folder. */
export type ManifestCheck = (manifest: ExtensionManifest) => void | Promise<void>;

export class InstallationManager {
	extensionPath = getExtensionsPath();

	async install(versionId: string) {
		const logger = useLogger();
		const tempDir = join(env['TEMP_PATH'] as string, 'marketplace', versionId);
		const tmpStorage = new DriverLocal({ root: tempDir });

		try {
			await mkdir(tempDir, { recursive: true });

			const options: DownloadOptions = {};

			if (env['MARKETPLACE_REGISTRY'] && typeof env['MARKETPLACE_REGISTRY'] === 'string') {
				options.registry = env['MARKETPLACE_REGISTRY'];
			}

			let tarReadableStream;

			try {
				tarReadableStream = await download(versionId, env['MARKETPLACE_TRUST'] === 'sandbox', options);
			} catch (error) {
				throw new ServiceUnavailableError(
					{ service: 'marketplace', reason: 'Could not download the extension' },
					{ cause: error },
				);
			}

			if (!tarReadableStream) {
				throw new Error(`No readable stream returned from download`);
			}

			const tarStream = Readable.fromWeb(tarReadableStream as ReadableStream);

			await this.extractAndStore(tarStream, { source: 'registry', folder: versionId }, tempDir, tmpStorage);
		} catch (err) {
			logger.warn(err);

			// rethrow marketplace servic unavailable
			if (isBackofficeError(err, ErrorCode.ServiceUnavailable)) {
				throw err;
			}

			throw new ServiceUnavailableError(
				{ service: 'extensions', reason: 'Failed to extract the extension or write it to storage' },
				{ cause: err },
			);
		} finally {
			await rm(tempDir, { recursive: true });
		}
	}

	/**
	 * Backoffice (spec 031, D-212): installs the npm-pack tarball of an upload into .upload/<folder>. `check` runs on the
	 * manifest before the package is copied anywhere (name, sandbox, limit). A package the checks or the format reject is
	 * an InvalidPayloadError (400), and so is any other Backoffice error (413 of the size limit, limit exceeded); an I/O
	 * error is the 503 of the registry install. The temp folder is always removed; a package already copied is not (the
	 * caller removes it with `uninstall(folder, 'upload')` when a later step fails).
	 */
	async installFromStream(tarStream: Readable, folder: string, check?: ManifestCheck): Promise<ExtensionManifest> {
		const logger = useLogger();
		const tempDir = join(env['TEMP_PATH'] as string, 'upload-extensions', folder);
		const tmpStorage = new DriverLocal({ root: tempDir });

		try {
			await mkdir(tempDir, { recursive: true });
			return await this.extractAndStore(tarStream, { source: 'upload', folder }, tempDir, tmpStorage, check);
		} catch (err) {
			if (isBackofficeError(err)) throw err;

			logger.warn(err);

			throw new ServiceUnavailableError(
				{ service: 'extensions', reason: 'Failed to extract the extension or write it to storage' },
				{ cause: err },
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	}

	private async extractAndStore(
		tarStream: Readable,
		{ source, folder }: { source: InstalledSource; folder: string },
		tempDir: string,
		tmpStorage: DriverLocal,
		check?: ManifestCheck,
	): Promise<ExtensionManifest> {
		const upload = source === 'upload';
		const tarPath = join(tempDir, `bin.tar.tgz`);
		await tmpStorage.write('bin.tar.tgz', tarStream);

		/**
		 * NPM modules that are packed are always tarballed in a folder called "package"
		 */
		const extractedPath = 'package';

		if (upload) {
			// Backoffice (spec 031, research T001a): strict, so a file that is not a tar is an error and not an empty
			// folder; links are dropped (an npm-pack tarball has none) so nothing copied later follows one out.
			try {
				await extract({
					file: tarPath,
					cwd: tempDir,
					strict: true,
					filter: (_path, entry) => !('type' in entry) || (entry.type !== 'SymbolicLink' && entry.type !== 'Link'),
				});
			} catch {
				throw new InvalidPayloadError({ reason: 'The file is not a gzipped tar archive' });
			}
		} else {
			await extract({
				file: tarPath,
				cwd: tempDir,
			});
		}

		let packageFile;

		try {
			packageFile = JSON.parse(await readFile(join(tempDir, extractedPath, 'package.json'), { encoding: 'utf-8' }));
		} catch (error) {
			if (!upload) throw error;

			throw new InvalidPayloadError({
				reason:
					(error as NodeJS.ErrnoException).code === 'ENOENT'
						? 'package/package.json is missing (npm pack layout expected)'
						: 'Invalid extension manifest: package/package.json is not valid JSON',
			});
		}

		let extensionManifest: ExtensionManifest;

		try {
			extensionManifest = await ExtensionManifest.parseAsync(packageFile);
		} catch (error) {
			if (!upload) throw error;

			const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;
			const detail = issues?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
			throw new InvalidPayloadError({ reason: `Invalid extension manifest: ${detail ?? String(error)}` });
		}

		if (!extensionManifest[EXTENSION_PKG_KEY]?.type) {
			if (upload) throw new InvalidPayloadError({ reason: 'Extension type not found in package.json' });
			throw new Error(`Extension type not found in package.json`);
		}

		await check?.(extensionManifest);

		const subfolder = SOURCE_FOLDER[source];

		if (env['EXTENSIONS_LOCATION']) {
			// Upload the extension into the configured extensions location
			const storage = await getStorage();
			const remoteDisk = storage.location(env['EXTENSIONS_LOCATION'] as string);

			const queue = new Queue({ concurrency: 1000 });
			const manifestFile = join(extractedPath, 'package.json');
			const remotePath = (filepath: string) =>
				join(env['EXTENSIONS_PATH'] as string, subfolder, folder, filepath.substring(extractedPath.length));

			for await (const filepath of tmpStorage.list(extractedPath)) {
				// Backoffice (spec 031, checklist CHK035): package.json last, so a node syncing meanwhile, or a restart
				// after a crash, never takes a half-copied folder for an extension (a folder without one is skipped).
				if (filepath === manifestFile) continue;

				const readStream = await tmpStorage.read(filepath);

				queue.add(() => remoteDisk.write(remotePath(filepath), readStream));
			}

			await queue.onIdle();
			await remoteDisk.write(remotePath(manifestFile), await tmpStorage.read(manifestFile));
		}

		// move to regular local extensions folder
		// Backoffice (spec 031, race found on MySQL): an upload is staged in the hidden `.upload/.<folder>` until its row
		// exists (activateUpload); a reload of this node in between would otherwise load it as a folder without a row.
		const dest = join(this.extensionPath, subfolder, upload ? stagedName(folder) : folder);
		await move(join(tempDir, extractedPath), dest, { overwrite: true });

		return extensionManifest;
	}

	/** Backoffice (spec 031): makes a staged upload visible to the scan of this node, once its row is written. */
	async activateUpload(folder: string) {
		const base = join(this.extensionPath, SOURCE_FOLDER.upload);
		await move(join(base, stagedName(folder)), join(base, folder), { overwrite: true });
	}

	async uninstall(folder: string, source: InstalledSource = 'registry') {
		const subfolder = SOURCE_FOLDER[source];

		if (env['EXTENSIONS_LOCATION']) {
			const storage = await getStorage();
			const remoteDisk = storage.location(env['EXTENSIONS_LOCATION'] as string);

			const queue = new Queue({ concurrency: 1000 });

			const prefix = join(env['EXTENSIONS_PATH'] as string, subfolder, folder);

			for await (const filepath of remoteDisk.list(prefix)) {
				queue.add(() => remoteDisk.delete(filepath));
			}

			await queue.onIdle();
		}

		const path = join(this.extensionPath, subfolder, folder);
		await remove(path);
		// Backoffice (spec 031): an upload removed before its activation is still staged.
		if (source === 'upload') await remove(join(this.extensionPath, subfolder, stagedName(folder)));
	}

	/**
	 * Backoffice (spec 031, D-212): the package name of an uploaded folder, read from the shared storage when there is one
	 * (another node may have uploaded it and this node not synced it yet), else from the local folder; undefined when
	 * the folder or its package.json is gone.
	 */
	async readUploadedName(folder: string): Promise<string | undefined> {
		try {
			let text: string;

			if (env['EXTENSIONS_LOCATION']) {
				const storage = await getStorage();
				const remoteDisk = storage.location(env['EXTENSIONS_LOCATION'] as string);
				const stream = await remoteDisk.read(join(env['EXTENSIONS_PATH'] as string, '.upload', folder, 'package.json'));
				text = await streamToString(stream);
			} else {
				text = await readFile(join(this.extensionPath, '.upload', folder, 'package.json'), 'utf-8');
			}

			const name = (JSON.parse(text) as { name?: unknown }).name;
			return typeof name === 'string' ? name : undefined;
		} catch {
			return undefined;
		}
	}
}

async function streamToString(stream: Readable): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	return Buffer.concat(chunks).toString('utf-8');
}
