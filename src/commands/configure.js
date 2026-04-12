/**
 * `cloudflare configure`
 *
 * Writes Cloudflare credentials to ~/.config/cli-cloudflare/config.json.
 * Supports two modes:
 *
 *   - Non-interactive: pass --api-token, --account-id, --api-base-url as
 *     flags. Any value not provided falls back to the existing saved
 *     config, so partial rotations work (e.g. only --api-token to rotate).
 *
 *   - Interactive: if stdin/stdout are a TTY, any value still missing
 *     after flag + existing-config fallback is prompted for. Only the
 *     apiToken is required; accountId and apiBaseUrl may be left blank.
 *
 * In neither mode do we read environment variables.
 */

import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getDefaultApiBaseUrl,
} from '../utils/config.js';
import { ask, closeRl } from '../utils/readline.js';

export function configureCommand() {
  const cmd = new Command('configure');
  cmd
    .description('Write Cloudflare credentials to ~/.config/cli-cloudflare/config.json')
    .option('--api-token <token>', 'Cloudflare API token')
    .option('--account-id <id>', 'Cloudflare account ID (optional)')
    .option('--api-base-url <url>', 'Cloudflare API base URL (optional)')
    .action(async (opts) => {
      const runtime = getRuntime();
      const out = createOutput(runtime);

      const existing = loadConfig() || {};

      let apiToken = opts.apiToken ?? existing.apiToken;
      let accountId = opts.accountId ?? existing.accountId;
      let apiBaseUrl = opts.apiBaseUrl ?? existing.apiBaseUrl;

      // In interactive mode, prompt for anything still missing.
      if (runtime.interactive) {
        if (!apiToken) {
          process.stderr.write(
            '(heads up: API token input will be visible in the terminal — if that is a concern, Ctrl-C and pass --api-token)\n'
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
      if (!apiToken) missing.push('--api-token');

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
