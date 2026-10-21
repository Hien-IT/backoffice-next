// Ported from directus/api/src/cli/commands/users/create.ts
import getDatabase from '../../../database/index.js';
import { useLogger } from '../../../logger/index.js';
import { UsersService } from '../../../services/users.service.js';
import { getSchema } from '../../../schema/get-database-schema.js';

export default async function usersCreate({
	email,
	password,
	role,
}: {
	email?: string;
	password?: string;
	role?: string;
}): Promise<void> {
	const database = getDatabase();
	const logger = useLogger();

	if (!email || !password || !role) {
		logger.error('Email, password, role are required');
		process.exit(1);
	}

	try {
		const schema = await getSchema();
		const service = new UsersService({ schema, knex: database });

		const id = await service.createOne({ email, password, role, status: 'active' });
		process.stdout.write(`${String(id)}\n`);
		database.destroy();
		process.exit(0);
	} catch (err: any) {
		logger.error(err);
		process.exit(1);
	}
}
