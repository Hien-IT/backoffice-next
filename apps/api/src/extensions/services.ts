// Backoffice (spec 020 research R3, D-141): the services of directus/api/src/services/index.ts that are not in the
// item service index here (they import the HTTP server or are not item services), handed to extensions with it.
// WebSocketService and the deployment services do not exist (out of scope, Principle XI).
export async function extraServices(): Promise<Record<string, unknown>> {
	const [authentication, extensions, graphql, mail, server, settings, specifications, tfa, utils] = await Promise.all([
		import('../services/authentication.service.js'),
		import('../services/extensions.service.js'),
		import('../services/graphql/index.js'),
		import('../services/mail.service.js'),
		import('../services/server.service.js'),
		import('../services/settings.service.js'),
		import('../services/specifications.service.js'),
		import('../services/tfa.service.js'),
		import('../services/utils.service.js'),
	]);

	return {
		AuthenticationService: authentication.AuthenticationService,
		ExtensionsService: extensions.ExtensionsService,
		ExtensionReadError: extensions.ExtensionReadError,
		GraphQLService: graphql.GraphQLService,
		MailService: mail.MailService,
		ServerService: server.ServerService,
		SettingsService: settings.SettingsService,
		SpecificationService: specifications.SpecificationService,
		TFAService: tfa.TFAService,
		UtilsService: utils.UtilsService,
	};
}
