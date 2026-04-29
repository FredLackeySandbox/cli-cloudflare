/**
 * Program entry point. Builds the commander tree, installs the --json /
 * --interactive global flag hook, and catches any thrown error from an
 * async action and routes it through the structured fatalError emitter.
 */

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { setForceJson, setForceInteractive } from './utils/runtime.js';
import { fatalError } from './utils/errors.js';
import { configureCommand } from './commands/configure.js';
import { catalogCommand } from './commands/catalog.js';
import { zoneCommand } from './commands/zone.js';
import { dnsCommand } from './commands/dns.js';
import { tokenCommand } from './commands/token.js';
import { accountsCommand } from './commands/accounts.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

export async function cli(argv) {
  // Peek at argv before commander parses so that even pre-parse errors
  // respect the caller's preferred output mode.
  if (argv.includes('--json')) setForceJson(true);
  if (argv.includes('--interactive')) setForceInteractive(true);

  const program = new Command();

  program
    .name('cloudflare')
    .description('AI-first CLI for Cloudflare zone, DNS, and token management')
    .version(version)
    .option('--json', 'force JSON output (default when stdout is not a TTY)')
    .option('--interactive', 'force interactive/human-friendly output')
    .hook('preAction', (thisCommand, actionCommand) => {
      const opts = actionCommand.optsWithGlobals();
      if (opts.json) setForceJson(true);
      if (opts.interactive) setForceInteractive(true);
    });

  program.addCommand(configureCommand());
  program.addCommand(catalogCommand());
  program.addCommand(zoneCommand());
  program.addCommand(dnsCommand());
  program.addCommand(tokenCommand());
  program.addCommand(accountsCommand());

  applyHelpOnError(program);

  try {
    await program.parseAsync(argv);
  } catch (err) {
    fatalError(err);
  }
}

/**
 * Recursively install an exitOverride that prints help on commander parse
 * errors (missing arg, unknown option, etc.) instead of a one-line message.
 */
function applyHelpOnError(cmd) {
  const HELP_CODES = new Set([
    'commander.missingArgument',
    'commander.missingMandatoryOptionValue',
    'commander.invalidArgument',
    'commander.invalidOptionArgument',
    'commander.unknownOption',
    'commander.unknownCommand',
    'commander.excessArguments',
  ]);

  cmd.exitOverride((err) => {
    if (err.code === 'commander.help' ||
        err.code === 'commander.version' ||
        err.code === 'commander.helpDisplayed') {
      process.exit(err.exitCode ?? 0);
    }

    if (HELP_CODES.has(err.code)) {
      process.stderr.write('\n');
      cmd.outputHelp({ error: true });
      process.exit(err.exitCode ?? 1);
    }

    throw err;
  });

  for (const sub of cmd.commands ?? []) {
    applyHelpOnError(sub);
  }
}
