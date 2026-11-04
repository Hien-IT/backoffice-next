// Ported from directus/api/src/services/extensions.ts
// Backoffice (spec 020): full port. Spec 031 (D-212): installUpload, and uninstall of the `upload` source.
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { useEnv } from '@backoffice/env';
import { EXTENSION_PKG_KEY, type ExtensionManifest } from '@backoffice/extensions';
import { ForbiddenError, InvalidPayloadError, LimitExceededError, UnprocessableContentError } from '@backoffice/errors';
import type {
	AbstractServiceOptions,
	Accountability,
	ApiOutput,
	BundleExtension,
	DeepPartial,
	ExtensionManager,
	ExtensionSettings,
	SchemaOverview,
} from '@backoffice/types';
import { isObject } from '@backoffice/utils';
import type { Knex } from 'knex';
import getDatabase from '../database/index.js';
import { getExtensionManager } from '../extensions/index.js';
import { getInstallationManager } from '../extensions/lib/installation/index.js';
import { withSettingsLock } from '../extensions/lib/settings-lock.js';
import { describe, type DescribeOptions } from '../extensions/registry/index.js';
import { transaction } from '../utils/transaction.js';
import { ItemsService } from './items.service.js';

export class ExtensionReadError extends Error {
	originalError: unknown;
	constructor(originalError: unknown) {
		super();
		this.originalError = originalError;
	}
}

export class ExtensionsService {
	knex: Knex;
	accountability: Accountability | null;
	schema: SchemaOverview;
	extensionsItemService: ItemsService<ExtensionSettings & Record<string, any>>;
	extensionsManager: ExtensionManager;

	constructor(options: AbstractServiceOptions) {
		this.knex = options.knex || getDatabase();
		this.schema = options.schema;
		this.accountability = options.accountability || null;
		this.extensionsManager = getExtensionManager();

		this.extensionsItemService = new ItemsService<ExtensionSettings & Record<string, any>>('directus_extensions', {
			knex: this.knex,
			schema: this.schema,
			accountability: this.accountability,
		});
	}

	private async preInstall(extensionId: string, versionId: string) {
		const env = useEnv();

		const describeOptions: DescribeOptions = {};

		if (typeof env['MARKETPLACE_REGISTRY'] === 'string') {
			describeOptions.registry = env['MARKETPLACE_REGISTRY'];
		}

		const extension = await describe(extensionId, describeOptions);
		const version = extension.data.versions.find((version) => version.id === versionId);

		if (!version) {
			throw new ForbiddenError();
		}

		/**
		 * Bundle extensions should be counted as the number of nested entries rather than a single
		 * extension to avoid a vulnerability where you can get around the technical limit by bundling
		 * all extensions you want
		 */
		this.assertLimit(version.bundled.length ?? 1);

		return { extension, version };
	}

	// Backoffice (spec 031): the EXTENSIONS_LIMIT check of preInstall, shared with installUpload.
	private assertLimit(points: number) {
		const env = useEnv();
		const limit = env['EXTENSIONS_LIMIT'] ? Number(env['EXTENSIONS_LIMIT']) : null;

		if (limit !== null) {
			const currentlyInstalledCount = this.extensionsManager.extensions.length;

			const afterInstallCount = currentlyInstalledCount + points;

			if (afterInstallCount >= limit) {
				throw new LimitExceededError({ category: 'Extensions' });
			}
		}
	}

	/**
	 * Backoffice (spec 031, D-212, research R5): installs the npm-pack tarball of an upload. The package is checked
	 * (format, manifest, sandbox under MARKETPLACE_TRUST=sandbox, EXTENSIONS_LIMIT, no other top-level extension of the
	 * same name) before it leaves the temp folder, copied to .upload/<id> of the shared storage and the local folder,
	 * then its rows are written under the extensions settings lock, after the name is checked again against the
	 * uploads of other nodes; every node then syncs and reloads. Any failure after the copy removes the files and rows.
	 */
	async installUpload(stream: Readable): Promise<ApiOutput> {
		const env = useEnv();
		const installation = getInstallationManager();
		const id = randomUUID();

		const manifest = await installation.installFromStream(stream, id, (candidate) => {
			const options = candidate[EXTENSION_PKG_KEY];

			if (env['MARKETPLACE_TRUST'] === 'sandbox' && hasApiPart(candidate) && !isSandboxed(candidate)) {
				throw new InvalidPayloadError({ reason: 'MARKETPLACE_TRUST=sandbox requires a sandboxed extension' });
			}

			this.assertLimit(options.type === 'bundle' ? options.entries.length : 1);
			this.assertNameFree(candidate.name, this.extensionsManager.getExtensionSourceByName(candidate.name));
		});

		try {
			await withSettingsLock(async () => {
				const rows = (await this.extensionsItemService.readByQuery({ limit: -1 })) as ExtensionSettings[];

				for (const row of rows) {
					if (row.source !== 'upload' || row.bundle !== null || row.folder === id) continue;
					if ((await installation.readUploadedName(row.folder)) === manifest.name) {
						this.assertNameFree(manifest.name, 'upload');
					}
				}

				// A node that synced the folder before this lock may have created the rows already (FR-011).
				const own = rows.filter((row) => row.id === id || row.bundle === id);
				const options = manifest[EXTENSION_PKG_KEY];

				if (!own.some((row) => row.id === id)) {
					await this.extensionsItemService.createOne({
						id,
						enabled: true,
						folder: id,
						source: 'upload',
						bundle: null,
					});
				}

				if (options.type === 'bundle') {
					const missing = options.entries.filter((entry) => !own.some((row) => row.folder === entry.name));

					if (missing.length > 0) {
						await this.extensionsItemService.createMany(
							missing.map((entry) => ({ enabled: true, folder: entry.name, source: 'upload', bundle: id })),
						);
					}
				}

				// Only now the scan of this node sees the package (it was staged until its row existed).
				await installation.activateUpload(id);
			});
		} catch (error) {
			// Best effort: the original error is the one the caller gets.
			await this.extensionsItemService
				// A settings pass of another node may have written a row for the folder with an id of its own.
				.deleteByQuery({
					filter: {
						_or: [
							{ id: { _eq: id } },
							{ bundle: { _eq: id } },
							{ _and: [{ folder: { _eq: id } }, { source: { _eq: 'upload' } }] },
						],
					},
				})
				.then(
					() => undefined,
					() => undefined,
				);
			await installation.uninstall(id, 'upload').then(
				() => undefined,
				() => undefined,
			);
			throw error;
		}

		await this.extensionsManager.installed({ source: 'upload', folder: id });

		return this.readOne(id);
	}

	private assertNameFree(name: string, source: string | undefined) {
		if (source) {
			throw new InvalidPayloadError({ reason: `An extension named "${name}" is already installed (${source})` });
		}
	}

	async install(extensionId: string, versionId: string) {
		const { extension, version } = await this.preInstall(extensionId, versionId);

		await this.extensionsItemService.createOne({
			id: extensionId,
			enabled: true,
			folder: versionId,
			source: 'registry',
			bundle: null,
		});

		if (extension.data.type === 'bundle' && version.bundled.length > 0) {
			await this.extensionsItemService.createMany(
				version.bundled.map((entry) => ({
					enabled: true,
					folder: entry.name,
					source: 'registry',
					bundle: extensionId,
				})),
			);
		}

		await this.extensionsManager.install(versionId);
	}

	async uninstall(id: string) {
		const settings = await this.extensionsItemService.readOne(id);

		// Backoffice (spec 031, D-212.3): an uploaded package is uninstalled like a registry one.
		if (settings.source !== 'registry' && settings.source !== 'upload') {
			throw new InvalidPayloadError({
				reason: 'Cannot uninstall extensions that were not installed via marketplace',
			});
		}

		if (settings.bundle !== null) {
			throw new InvalidPayloadError({
				reason: 'Cannot uninstall sub extensions of bundles separately',
			});
		}

		await this.deleteOne(id);
		await this.extensionsManager.uninstall(settings.folder, settings.source);
	}

	async reinstall(id: string) {
		const settings = await this.extensionsItemService.readOne(id);

		if (settings.source !== 'registry') {
			throw new InvalidPayloadError({
				reason: 'Cannot reinstall extensions that were not installed via marketplace',
			});
		}

		if (settings.bundle !== null) {
			throw new InvalidPayloadError({
				reason: 'Cannot reinstall sub extensions of bundles separately',
			});
		}

		const extensionId = settings.id;
		const versionId = settings.folder;

		await this.preInstall(extensionId, versionId);
		await this.extensionsManager.install(versionId);
	}

	async readAll() {
		// wait for extensions to be reloaded
		await this.extensionsManager.isReloading();

		const settings = await this.extensionsItemService.readByQuery({ limit: -1 });

		const regular = settings.filter(({ bundle }) => bundle === null);
		const bundled = settings.filter(({ bundle }) => bundle !== null);

		const output: ApiOutput[] = [];

		for (const meta of regular) {
			output.push({
				id: meta.id,
				bundle: meta.bundle,
				meta: meta,
				schema: this.extensionsManager.getExtension(meta.source, meta.folder) ?? null,
			});
		}

		for (const meta of bundled) {
			const parentBundle = output.find((ext) => ext.id === meta.bundle);

			if (!parentBundle) continue;

			const schema = (parentBundle.schema as BundleExtension | null)?.entries.find(
				(entry) => entry.name === meta.folder,
			);

			if (!schema) continue;

			output.push({
				id: meta.id,
				bundle: meta.bundle,
				meta: meta,
				schema: schema,
			});
		}

		return output;
	}

	async readOne(id: string): Promise<ApiOutput> {
		// wait for extensions to be reloaded
		await this.extensionsManager.isReloading();
		const meta = await this.extensionsItemService.readOne(id);
		const schema = this.extensionsManager.getExtension(meta.source, meta.folder) ?? null;

		return {
			id: meta.id,
			bundle: meta.bundle,
			schema,
			meta,
		};
	}

	async updateOne(id: string, data: DeepPartial<ApiOutput>) {
		const result = await transaction(this.knex, async (trx) => {
			if (!isObject(data.meta)) {
				throw new InvalidPayloadError({ reason: `"meta" is required` });
			}

			const service = new ExtensionsService({
				knex: trx,
				accountability: this.accountability,
				schema: this.schema,
			});

			await service.extensionsItemService.updateOne(id, data.meta);

			let extension;

			try {
				extension = await service.readOne(id);
			} catch (error) {
				throw new ExtensionReadError(error);
			}

			if ('enabled' in data.meta) {
				await service.checkBundleAndSyncStatus(trx, id, extension);
			}

			return extension;
		});

		this.extensionsManager.reload().then(() => {
			this.extensionsManager.broadcastReloadNotification();
		});

		return result;
	}

	async deleteOne(id: string) {
		await this.extensionsItemService.deleteOne(id);
		await this.extensionsItemService.deleteByQuery({ filter: { bundle: { _eq: id } } });
	}

	/**
	 * Sync a bundles enabled status
	 *  - If the extension or extensions parent is not a bundle changes are skipped
	 *  - If a bundles status is toggled, all children are set to that status
	 *  - If an entries status is toggled, then if the:
	 *    - Parent bundle is non-partial throws UnprocessableContentError
	 *    - Entry status change resulted in all children being disabled then the parent bundle is disabled
	 *    - Entry status change resulted in at least one child being enabled then the parent bundle is enabled
	 */
	private async checkBundleAndSyncStatus(trx: Knex, extensionId: string, extension: ApiOutput) {
		if (extension.bundle === null && extension.schema?.type === 'bundle') {
			// If extension is the parent bundle, set it and all nested extensions to enabled
			await trx('directus_extensions')
				.update({ enabled: extension.meta.enabled })
				.where({ bundle: extensionId })
				.orWhere({ id: extensionId });

			return;
		}

		const parentId = extension.bundle ?? extension.meta.bundle;

		if (!parentId) return;

		const parent = await this.readOne(parentId);

		if (parent.schema?.type !== 'bundle') {
			return;
		}

		if (parent.schema.partial === false) {
			throw new UnprocessableContentError({
				reason: 'Unable to toggle status of an entry for a bundle marked as non partial',
			});
		}

		const hasEnabledChildren = !!(await trx('directus_extensions')
			.where({ bundle: parentId })
			.where({ enabled: true })
			.first());

		if (hasEnabledChildren) {
			await trx('directus_extensions').update({ enabled: true }).where({ id: parentId });
		} else {
			await trx('directus_extensions').update({ enabled: false }).where({ id: parentId });
		}
	}
}

/** Backoffice (spec 031, FR-006): whether a package runs code in the API (an app-only package has no sandbox option). */
function hasApiPart(manifest: ExtensionManifest): boolean {
	const options = manifest[EXTENSION_PKG_KEY];
	const api = ['hook', 'endpoint', 'operation'];

	if (options.type === 'bundle') return options.entries.some((entry) => api.includes(entry.type));
	return api.includes(options.type);
}

/** A bundle has no sandbox option in the DR manifest, so a bundle with an API entry is never sandboxed. */
function isSandboxed(manifest: ExtensionManifest): boolean {
	const options = manifest[EXTENSION_PKG_KEY] as { sandbox?: { enabled?: boolean } };
	return options.sandbox?.enabled === true;
}
