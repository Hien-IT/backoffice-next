// Ported from directus/packages/errors/src/create-error.ts
import type { BackofficeError } from '@backoffice/types';

export interface BackofficeErrorConstructor<Extensions = void> {
	new (extensions: Extensions, options?: ErrorOptions): BackofficeError<Extensions>;
	readonly prototype: BackofficeError<Extensions>;
}

export const createError = <Extensions = void>(
	code: string,
	message: string | ((extensions: Extensions) => string),
	status = 500,
): BackofficeErrorConstructor<Extensions> => {
	return class extends Error implements BackofficeError<Extensions> {
		// Backoffice: same name as Directus, it is serialized into flow data ($all, run revisions); feature 009 R7
		override name = 'DirectusError';
		extensions: Extensions;
		code = code.toUpperCase();
		status = status;

		constructor(extensions: Extensions, options?: ErrorOptions) {
			const msg = typeof message === 'string' ? message : message(extensions as Extensions);

			super(msg, options);

			this.extensions = extensions;
		}

		override toString() {
			return `${this.name} [${this.code}]: ${this.message}`;
		}
	};
};

export type { BackofficeError };
