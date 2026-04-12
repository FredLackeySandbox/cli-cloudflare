/**
 * `cloudflare token` subcommands: verify, list-permissions.
 *
 * `verify` checks whether the configured API token is valid.
 * `list-permissions` lists the account's available token permission groups
 * and requires --account-id.
 */

import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import { resolveCredentials, requireAccountId } from '../utils/config.js';
import {
  createCloudflareClient,
  withCredentialOptions,
} from '../utils/cloudflare-client.js';

export function tokenCommand() {
  const cmd = new Command('token');
  cmd.description('API token operations');

  // ── verify ────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('verify').description('Verify the active API token')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));

    const resp = await client.get('user/tokens/verify');
    const r = resp.result || {};
    const token = {
      id: r.id,
      status: r.status,
      expiresOn: r.expires_on || null,
    };

    out.heading('Token');
    if (runtime.interactive) {
      out.info(`ID:        ${token.id}`);
      out.info(`Status:    ${token.status}`);
      if (token.expiresOn) out.info(`Expires:   ${token.expiresOn}`);
    }
    out.set('token', token);
    out.flush();
  });

  // ── list-permissions ─────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('list-permissions')
      .description('List available API token permission groups (requires --account-id)')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const creds = resolveCredentials(opts);
    requireAccountId(creds);
    const client = createCloudflareClient(creds);

    const resp = await client.get(
      `accounts/${creds.accountId}/tokens/permission_groups`
    );
    const groups = (resp.result || []).map((g) => ({
      id: g.id,
      name: g.name,
      scopes: g.scopes || [],
    }));

    out.heading('Permission groups');
    if (runtime.interactive) {
      if (!groups.length) {
        out.dim('(none)');
      } else {
        for (const g of groups) {
          out.info(`${g.id}  ${g.name}`);
        }
        out.dim(`${groups.length} total`);
      }
    }
    out.set('groups', groups);
    out.set('total', groups.length);
    out.flush();
  });

  return cmd;
}
