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
 * When the API responds with an HTTP error or `success: false`, the client
 * throws an Error whose message is derived from the upstream payload and
 * whose `detail` carries the raw envelope where available. Otherwise the
 * full envelope is returned so callers can reach both `result` and
 * `result_info` (used for pagination).
 */

/**
 * Create a Cloudflare client.
 *
 * @param {{ apiToken: string, accountId?: string, apiBaseUrl: string }} creds
 */
export function createCloudflareClient(creds) {
  const baseUrl = creds.apiBaseUrl.replace(/\/$/, '') + '/';
  const defaultHeaders = {
    Authorization: `Bearer ${creds.apiToken}`,
    'Content-Type': 'application/json',
  };

  function unwrap(body, httpStatus) {
    if (body && body.success === false) {
      const errors = Array.isArray(body.errors) ? body.errors : [];
      const msg = errors.length
        ? errors.map((e) => e.message || JSON.stringify(e)).join('; ')
        : 'Cloudflare API request failed';
      const err = new Error(msg);
      err.code = 'cloudflare_api_error';
      err.detail = { errors: body.errors, messages: body.messages };
      err.httpStatus = httpStatus;
      err.httpBody = body;
      throw err;
    }
    return body;
  }

  async function request(method, pathname, body) {
    const url = new URL(pathname, baseUrl).toString();
    const init = {
      method,
      headers: defaultHeaders,
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const raw = await res.text();
    const parsed = raw ? tryParseJson(raw) : null;
    const responseBody = parsed === undefined ? raw : parsed;

    if (!res.ok) {
      const err = new Error(extractHttpErrorMessage(responseBody, res.status));
      err.code = 'cloudflare_http_error';
      err.httpStatus = res.status;
      err.httpBody = responseBody;
      if (responseBody && typeof responseBody === 'object') {
        err.detail = {
          errors: responseBody.errors,
          messages: responseBody.messages,
        };
      }
      throw err;
    }

    return unwrap(responseBody, res.status);
  }

  return {
    accountId: creds.accountId,

    async get(pathname) {
      return request('GET', pathname);
    },

    async post(pathname, body) {
      return request('POST', pathname, body);
    },

    async put(pathname, body) {
      return request('PUT', pathname, body);
    },

    async patch(pathname, body) {
      return request('PATCH', pathname, body);
    },

    async delete(pathname) {
      return request('DELETE', pathname);
    },
  };
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function extractHttpErrorMessage(body, status) {
  if (body && typeof body === 'object') {
    const errors = Array.isArray(body.errors) ? body.errors : [];
    if (errors.length) {
      return errors.map((e) => e.message || JSON.stringify(e)).join('; ');
    }
  }

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  return `Cloudflare API request failed with HTTP ${status}`;
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
