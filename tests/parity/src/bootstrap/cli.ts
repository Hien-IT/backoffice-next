// Spec 021 (contracts/tests.md): run `node cli.js ...` in a container of the parity env and keep the exit code, so the
// CLI of Directus 11.17.4 and of Backoffice can be compared command by command.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDbsToTest } from '../get-dbs-to-test.js';

export interface CliResult {
	code: number;
	stdout: string;
	stderr: string;
}

const PARITY_DIR = fileURLToPath(new URL('../../', import.meta.url));

function composeArgs(): string[] {
	const [vendor] = getDbsToTest();
	return [
		'compose',
		'-p',
		`parity-${vendor}`,
		'-f',
		'docker-compose.yml',
		'--profile',
		vendor!,
		'--profile',
		'bootstrap',
	];
}

function run(args: string[], stdin?: string): CliResult {
	const result = spawnSync('docker', [...composeArgs(), ...args], {
		cwd: PARITY_DIR,
		encoding: 'utf8',
		input: stdin,
		maxBuffer: 64 * 1024 * 1024,
		// A command that never ends (a `start` that should have failed) must not hang the run.
		timeout: 300_000,
		env: process.env,
	});

	if (result.error) throw result.error;
	return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

const envArgs = (env: Record<string, string>) => Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

/** `node cli.js <args>` inside the running container of `service` (`compose exec -T`). */
export function cli(service: string, args: string[], env: Record<string, string> = {}, stdin?: string): CliResult {
	return run(['exec', '-T', ...envArgs(env), service, 'node', 'cli.js', ...args], stdin);
}

/** One prompt of an interactive command and the keys typed once it shows (`\x1b[B` is the down arrow). */
export interface PromptStep {
	prompt: string;
	keys: string;
}

/**
 * `docker compose <args>` answering prompts as they show: inquirer reads a non-TTY stdin, but only the keys that arrive
 * after its prompt is rendered (research R15, T058). Ends when the process exits, or when `stopOn` is printed (the
 * process is then killed with the compose client).
 */
export function interactive(
	args: string[],
	steps: PromptStep[],
	options: { stopOn?: string; timeoutMs?: number } = {},
): Promise<CliResult> {
	return new Promise((resolve, reject) => {
		const child = spawn('docker', [...composeArgs(), ...args], { cwd: PARITY_DIR, env: process.env });
		let stdout = '';
		let stderr = '';
		let from = 0;
		let step = 0;

		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			reject(new Error(`docker compose ${args.join(' ')} timed out; output:\n${stdout}${stderr}`));
		}, options.timeoutMs ?? 300_000);

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();

			if (options.stopOn && stdout.includes(options.stopOn)) {
				child.kill('SIGKILL');
				return;
			}

			while (step < steps.length) {
				const at = stdout.indexOf(steps[step]!.prompt, from);
				if (at === -1) break;
				from = at + steps[step]!.prompt.length;
				const { keys } = steps[step]!;
				setTimeout(() => child.stdin.write(keys), 300);
				step++;
			}
		});

		child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

		child.on('close', (code) => {
			clearTimeout(timer);
			resolve({ code: code ?? -1, stdout, stderr });
		});
	});
}

/** `docker compose exec -T` arguments running a shell script in `service`. */
export const execArgs = (service: string, script: string, env: Record<string, string> = {}) => [
	'exec',
	'-T',
	...envArgs(env),
	service,
	'sh',
	'-c',
	script,
];

/** `node cli.js <args>` in a new container of `service` that is removed afterwards (`compose run --rm --no-deps`). */
export function cliRun(service: string, args: string[], env: Record<string, string> = {}): CliResult {
	return run(['run', '--rm', '--no-deps', '-T', ...envArgs(env), '--entrypoint', 'node', service, 'cli.js', ...args]);
}

/** The output of a service (stdout and stderr, no prefix), optionally since a Docker timestamp. */
export function serviceLogs(service: string, since?: string): string {
	return run(['logs', '--no-color', '--no-log-prefix', ...(since ? ['--since', since] : []), service]).stdout;
}

/** `docker compose <args>` for this env; throws on a non-zero exit code. */
export function composeOk(...args: string[]): string {
	const result = run(args);
	if (result.code !== 0) throw new Error(`docker compose ${args.join(' ')} exited ${result.code}: ${result.stderr}`);
	return result.stdout;
}

/** KEY=VALUE of the env files of profile bootstrap, later files winning (as compose reads them). */
export function profileEnv(vendor: string): Record<string, string> {
	const values: Record<string, string> = {};

	for (const file of [`env/${vendor}.env`, 'env/profile-bootstrap.env']) {
		for (const line of readFileSync(`${PARITY_DIR}${file}`, 'utf8').split('\n')) {
			const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
			if (match) values[match[1]!] = match[2]!;
		}
	}

	return values;
}
