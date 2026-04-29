/**
 * Single-file config loader.
 *
 * Config lives at exactly `~/.config/cli-cloudflare/config.json` and nowhere
 * else. No environment variables, no project-local dotfiles, no ~/.{tool}rc.
 *
 * Value resolution precedence for any required input:
 *   1. command-line flag (passed in opts)
 *   2. this config file
 *   3. error
 *
 * See `~/Source/Personal/FredLackeySandbox/CLAUDE.md` Rule 2 for the policy.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLI_NAME = 'cli-cloudflare';
const CONFIG_DIR = path.join(os.homedir(), '.config', CLI_NAME);
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const OPTION_ALIASES = {
  apiToken: ['apiToken', 'apiKey'],
  accountId: ['accountId', 'account'],
  apiBaseUrl: ['apiBaseUrl'],
};
const FLAG_NAMES = {
  apiToken: '--api-token or --api-key',
  accountId: '--account-id or --account',
  apiBaseUrl: '--api-base-url',
};

export function getConfigPath() {
  return CONFIG_FILE;
}

export function getConfigDir() {
  return CONFIG_DIR;
}

export function getDefaultApiBaseUrl() {
  return DEFAULT_API_BASE_URL;
}

/**
 * Load the config file. Returns null if it does not exist or cannot be
 * parsed. Callers should treat null as "nothing saved yet" and fall through
 * to command-line flags.
 */
export function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write the config file atomically. Creates the parent directory if needed.
 * File mode is 0600 (owner read/write only) since it contains an API token.
 */
export function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_FILE);
}

/**
 * Remove the saved config file if present. Also removes the config directory
 * when it becomes empty.
 */
export function deleteConfig() {
  let removed = false;
  try {
    fs.unlinkSync(CONFIG_FILE);
    removed = true;
  } catch (err) {
    if (err && err.code !== 'ENOENT') throw err;
  }

  try {
    fs.rmdirSync(CONFIG_DIR);
  } catch (err) {
    if (err && err.code !== 'ENOENT' && err.code !== 'ENOTEMPTY') throw err;
  }

  return removed;
}

function getOptionKeys(key) {
  return OPTION_ALIASES[key] || [key];
}

function getOptionValue(key, opts) {
  for (const optionKey of getOptionKeys(key)) {
    if (
      opts &&
      opts[optionKey] !== undefined &&
      opts[optionKey] !== null &&
      opts[optionKey] !== ''
    ) {
      return opts[optionKey];
    }
  }
  return undefined;
}

/**
 * Resolve a required value from command-line flags first, then from the
 * saved config file. Throws a structured error if missing from both.
 *
 *   resolveValue('apiToken', opts, config, '--api-token')
 */
export function resolveValue(key, opts, config, flagName) {
  const optionValue = getOptionValue(key, opts);
  if (optionValue !== undefined) return optionValue;
  if (config && config[key] !== undefined && config[key] !== null && config[key] !== '') {
    return config[key];
  }
  const err = new Error(
    `Missing required value: ${flagName || FLAG_NAMES[key] || key}. Pass it as a flag or run "cloudflare configure".`
  );
  err.code = 'missing_required_value';
  err.detail = { key, flag: flagName || FLAG_NAMES[key] || key };
  throw err;
}

/**
 * Optional version of resolveValue: returns undefined if missing from both
 * sources, instead of throwing. Useful for values that are only required by
 * certain commands (e.g. accountId for zone create).
 */
export function resolveOptional(key, opts, config) {
  const optionValue = getOptionValue(key, opts);
  if (optionValue !== undefined) return optionValue;
  if (config && config[key] !== undefined && config[key] !== null && config[key] !== '') {
    return config[key];
  }
  return undefined;
}

/**
 * Convenience: resolve the Cloudflare credentials in one call.
 * apiToken is required, accountId is optional (some endpoints need it),
 * apiBaseUrl falls back to the Cloudflare default.
 */
export function resolveCredentials(opts) {
  const config = loadConfig();
  const apiToken = resolveValue('apiToken', opts, config, FLAG_NAMES.apiToken);
  const accountId = resolveOptional('accountId', opts, config);
  const apiBaseUrl =
    resolveOptional('apiBaseUrl', opts, config) || DEFAULT_API_BASE_URL;
  return { apiToken, accountId, apiBaseUrl };
}

/**
 * Resolve credentials for commands that require an accountId (e.g. zone
 * create, token list-permissions). Throws with a clear message if it is
 * missing.
 */
export function requireAccountId(creds) {
  if (!creds.accountId) {
    const err = new Error(
      `Missing required value: ${FLAG_NAMES.accountId}. Pass it as a flag or run "cloudflare configure".`
    );
    err.code = 'missing_required_value';
    err.detail = { key: 'accountId', flag: FLAG_NAMES.accountId };
    throw err;
  }
  return creds.accountId;
}
