// Ported from directus/packages/types/src/extensions/app-extension-config.ts, hooks.ts, endpoints.ts and manager.ts
// Backoffice: API side only (the web app uses @directus/types for the app configs, feature 013); the zod schemas live
// in @backoffice/extensions, so SplitEntrypoint and the sandbox options are plain types here (same shape).
import type { ReadStream } from 'node:fs';
import type {
	API_EXTENSION_TYPES,
	APP_EXTENSION_TYPES,
	BUNDLE_EXTENSION_TYPES,
	EXTENSION_TYPES,
	HYBRID_EXTENSION_TYPES,
	NESTED_EXTENSION_TYPES,
} from '@backoffice/constants';
import type { Router } from 'express';
import type { ActionHandler, EmbedHandler, FilterHandler, InitHandler, ScheduleHandler } from './events.js';
import type { ApiExtensionContext, OperationApiConfig } from './operations.js';

export type SplitEntrypoint = { app: string; api: string };

export type ExtensionSandboxRequestedScopes = {
	request?: { urls: string[]; methods: ('GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE')[] } | undefined;
	log?: Record<string, unknown> | undefined;
	sleep?: Record<string, unknown> | undefined;
};

export type ExtensionSandboxOptions =
	| { enabled: boolean; requestedScopes: ExtensionSandboxRequestedScopes }
	| undefined;

export interface ExtensionSettings {
	id: string;
	source: 'module' | 'registry' | 'local';
	enabled: boolean;
	bundle: string | null;
	folder: string;
}

/**
 * The API output structure used when engaging with the /extensions endpoints
 */
export interface ApiOutput {
	id: string;
	bundle: string | null;
	schema: Partial<Extension> | BundleExtensionEntry | null;
	meta: ExtensionSettings;
}

export type HookExtensionContext = ApiExtensionContext & {
	emitter: any;
};

export type RegisterFunctions = {
	filter: <T = unknown>(event: string, handler: FilterHandler<T>) => void;
	action: (event: string, handler: ActionHandler) => void;
	init: (event: string, handler: InitHandler) => void;
	schedule: (cron: string, handler: ScheduleHandler) => void;
	embed: (position: 'head' | 'body', code: string | EmbedHandler) => void;
};

export type HookConfig = (register: RegisterFunctions, context: HookExtensionContext) => void;

export type EndpointExtensionContext = ApiExtensionContext & {
	emitter: any;
};

type EndpointConfigFunction = (router: Router, context: EndpointExtensionContext) => void;

type EndpointConfigObject = {
	id: string;
	handler: EndpointConfigFunction;
};

export type EndpointConfig = EndpointConfigFunction | EndpointConfigObject;

export type BundleConfig = {
	endpoints: { name: string; config: EndpointConfig }[];
	hooks: { name: string; config: HookConfig }[];
	operations: { name: string; config: OperationApiConfig }[];
};

export type AppExtensionType = (typeof APP_EXTENSION_TYPES)[number];
export type ApiExtensionType = (typeof API_EXTENSION_TYPES)[number];
export type HybridExtensionType = (typeof HYBRID_EXTENSION_TYPES)[number];
export type BundleExtensionType = (typeof BUNDLE_EXTENSION_TYPES)[number];
export type NestedExtensionType = (typeof NESTED_EXTENSION_TYPES)[number];
export type ExtensionType = (typeof EXTENSION_TYPES)[number];

type ExtensionBase = {
	path: string;
	name: string;
	local: boolean;
	version?: string | undefined;
	host?: string | undefined;
};

export type AppExtension = ExtensionBase & {
	type: AppExtensionType;
	entrypoint: string;
};

export type ApiExtension = ExtensionBase & {
	type: ApiExtensionType;
	entrypoint: string;
	sandbox?: ExtensionSandboxOptions | undefined;
};

export type HybridExtension = ExtensionBase & {
	type: HybridExtensionType;
	entrypoint: SplitEntrypoint;
	sandbox?: ExtensionSandboxOptions | undefined;
};

export interface BundleExtensionEntry {
	name: string;
	type: AppExtensionType | ApiExtensionType | HybridExtensionType;
}

export type BundleExtension = ExtensionBase & {
	type: BundleExtensionType;
	partial: boolean | undefined;
	entrypoint: SplitEntrypoint;
	entries: BundleExtensionEntry[];
};

export type Extension = AppExtension | ApiExtension | HybridExtension | BundleExtension;

export interface ExtensionManagerOptions {
	schedule: boolean;
	watch: boolean;
}

export type ExtensionManager = {
	readonly extensions: Extension[];
	getExtension: (source: string, folder: string) => Extension | undefined;
	initialize: (options: Partial<ExtensionManagerOptions>) => Promise<void>;
	install: (versionId: string) => Promise<void>;
	uninstall: (folder: string) => Promise<void>;
	broadcastReloadNotification: () => Promise<void>;
	reload: (options?: { forceSync: boolean }) => Promise<unknown>;
	isReloading: () => Promise<void>;
	getAppExtensionChunk: (name?: string) => Promise<ReadStream | null>;
	getEndpointRouter: () => Router;
	getEmbeds: () => { head: string; body: string };
};
