/**
 * `cloudflare configure`
 *
 * Writes Cloudflare credentials to ~/.config/cli-cloudflare/config.json.
 * Supports two modes:
 *
 *   - Non-interactive: pass --api-token/--api-key, --account-id/--account,
 *     and --api-base-url as flags. Any value not provided falls back to the
 *     existing saved config, so partial rotations work (e.g. only
 *     --api-token to rotate).
 *
 *   - Interactive: if stdin/stdout are a TTY, any value still missing
 *     after flag + existing-config fallback is prompted for. Only the
 *     apiToken is required; accountId and apiBaseUrl may be left blank.
 *
 *   - Reset: pass --reset to remove the saved config file and exit.
 *
 * In neither mode do we read environment variables.
 */

import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import {
  deleteConfig,
  loadConfig,
  saveConfig,
  getConfigPath,
  getDefaultApiBaseUrl,
  resolveOptional,
} from '../utils/config.js';
import { ask, closeRl } from '../utils/readline.js';

export function configureCommand() {
  const cmd = new Command('configure');
  cmd
    .description('Write Cloudflare credentials to ~/.config/cli-cloudflare/config.json')
    .option('--api-token <token>', 'Cloudflare API token')
    .option('--api-key <token>', 'Alias for --api-token')
    .option('--account-id <id>', 'Cloudflare account ID (optional)')
    .option('--account <id>', 'Alias for --account-id')
    .option('--api-base-url <url>', 'Cloudflare API base URL (optional)')
    .option('--reset', 'Remove ~/.config/cli-cloudflare/config.json and exit')
    .action(async (opts) => {
      const runtime = getRuntime();
      const out = createOutput(runtime);

      if (opts.reset) {
        const removed = deleteConfig();
        out.heading('Configuration reset');
        if (removed) {
          out.success('Config removed', { path: getConfigPath() });
        } else {
          out.info('No config file found', { path: getConfigPath() });
        }
        out.set('path', getConfigPath());
        out.set('removed', removed);
        out.flush();
        return;
      }

      const existing = loadConfig() || {};

      let apiToken = resolveOptional('apiToken', opts, existing);
      let accountId = resolveOptional('accountId', opts, existing);
      let apiBaseUrl = resolveOptional('apiBaseUrl', opts, existing);

      // In interactive mode, prompt for anything still missing.
      if (runtime.interactive) {
        if (!apiToken) {
          process.stderr.write(
            '(heads up: API token input will be visible in the terminal — if that is a concern, Ctrl-C and pass --api-token or --api-key)\n'
          );
          apiToken = await ask('Cloudflare API token');
        }
        if (!accountId) {
          accountId = await ask('Cloudflare account ID (optional)');
        }
        if (!apiBaseUrl) {
          apiBaseUrl = await ask('Cloudflare API base URL', getDefaultApiBaseUrl());
        }
        closeRl();
      }

      const missing = [];
      if (!apiToken) missing.push('--api-token or --api-key');

      if (missing.length) {
        const err = new Error(`Missing required values: ${missing.join(', ')}`);
        err.code = 'missing_required_value';
        err.detail = { missing };
        throw err;
      }

      const config = { apiToken };
      if (accountId) config.accountId = accountId;
      if (apiBaseUrl) config.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');

      saveConfig(config);

      out.heading('Configured');
      out.success('Config written', { path: getConfigPath() });
      out.set('path', getConfigPath());
      if (config.accountId) out.set('accountId', config.accountId);
      out.set('apiBaseUrl', config.apiBaseUrl || getDefaultApiBaseUrl());
      // Deliberately omit apiToken from the result payload.
      out.flush();
    });

  return cmd;
}
