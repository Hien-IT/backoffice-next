// Backoffice: Directus registers the built-in operations by reading directus/api/src/operations at startup
// (extensions/manager.ts registerInternalOperations). There is no extension manager here (Principle XI), so the
// FlowManager registers this static list instead, in the order of the Directus folders (feature 009, research R2).
import type { OperationApiConfig } from '@backoffice/types';
import condition from './condition/index.js';
import exec from './exec/index.js';
import itemCreate from './item-create/index.js';
import itemDelete from './item-delete/index.js';
import itemRead from './item-read/index.js';
import itemUpdate from './item-update/index.js';
import jsonWebToken from './json-web-token/index.js';
import log from './log/index.js';
import mail from './mail/index.js';
import notification from './notification/index.js';
import request from './request/index.js';
import sleep from './sleep/index.js';
import throwError from './throw-error/index.js';
import transform from './transform/index.js';
import trigger from './trigger/index.js';

export const operations: OperationApiConfig<any>[] = [
	condition,
	exec,
	itemCreate,
	itemDelete,
	itemRead,
	itemUpdate,
	jsonWebToken,
	log,
	mail,
	notification,
	request,
	sleep,
	throwError,
	transform,
	trigger,
];
