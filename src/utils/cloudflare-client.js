/**
 * Cloudflare API HTTP client.
 *
 * Constructed fresh per command from resolved credentials. Zero module-level
 * state and zero environment variable access. Each command flow is:
 *
 *   const creds = resolveCredentials(opts);
 *   const client = createCloudflareClient(creds);
 *   const data = await client.get('zones');
 *
 * The Cloudflare REST API wraps all responses in an envelope of shape:
 *   { success, errors, messages, result, result_info }
 *
 * When `success: false`, the client throws an Error whose message is a
 * joined list of the upstream errors and whose `detail` carries the raw
 * envelope. Otherwise the full envelope is returned so callers can reach
 * both `result` and `result_info` (used for pagination).
 */

import axios from 'axios';

/**
 * Create a Cloudflare client.
 *
 * @param {{ apiToken: string, accountId?: string, apiBaseUrl: string }} creds
 */
export function createCloudflareClient(creds) {
  const http = axios.create({
    baseURL: creds.apiBaseUrl.replace(/\/$/, '') + '/',
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  function unwrap(res) {
    const body = res.data;
    if (body && body.success === false) {
      const errors = Array.isArray(body.errors) ? body.errors : [];
      const msg = errors.length
        ? errors.map((e) => e.message || JSON.stringify(e)).join('; ')
        : 'Cloudflare API request failed';
      const err = new Error(msg);
      err.code = 'cloudflare_api_error';
      err.detail = { errors: body.errors, messages: body.messages };
      throw err;
    }
    return body;
  }

  return {
    accountId: creds.accountId,

    async get(pathname) {
      const res = await http.get(pathname);
      return unwrap(res);
    },

    async post(pathname, body) {
      const res = await http.post(pathname, body);
      return unwrap(res);
    },

    async put(pathname, body) {
      const res = await http.put(pathname, body);
      return unwrap(res);
    },

    async patch(pathname, body) {
      const res = await http.patch(pathname, body);
      return unwrap(res);
    },

    async delete(pathname) {
      const res = await http.delete(pathname);
      return unwrap(res);
    },
  };
}

/**
 * Helper that each command uses to declare the credential flags consistently.
 * Returns the command for chaining.
 */
export function withCredentialOptions(cmd) {
  return cmd
    .option('--api-token <token>', 'Cloudflare API token')
    .option('--api-key <token>', 'Alias for --api-token')
    .option('--account-id <id>', 'Cloudflare account ID (required for some ops)')
    .option('--account <id>', 'Alias for --account-id')
    .option('--api-base-url <url>', 'Cloudflare API base URL');
}

/**
 * Resolve a zone identifier — accepts either a domain name or a 32-char hex
 * zone ID. Domain names are resolved via the API.
 */
export async function resolveZoneId(client, nameOrId) {
  if (/^[a-f0-9]{32}$/i.test(nameOrId)) {
    return nameOrId;
  }
  const resp = await client.get(`zones?name=${encodeURIComponent(nameOrId)}&per_page=1`);
  const zones = resp.result || [];
  if (zones.length === 0) {
    const err = new Error(`Zone not found for domain: ${nameOrId}`);
    err.code = 'zone_not_found';
    err.detail = { zone: nameOrId };
    throw err;
  }
  return zones[0].id;
}
