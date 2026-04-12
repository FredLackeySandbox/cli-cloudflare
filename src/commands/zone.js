/**
 * `cloudflare zone` subcommands: list, get, create.
 *
 * Every subcommand accepts --api-token, --account-id, --api-base-url and
 * falls back to ~/.config/cli-cloudflare/config.json for any that are
 * omitted.
 */

import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import { resolveCredentials, requireAccountId } from '../utils/config.js';
import {
  createCloudflareClient,
  withCredentialOptions,
} from '../utils/cloudflare-client.js';

function shapeZone(z) {
  return {
    id: z.id,
    name: z.name,
    status: z.status,
    paused: z.paused,
    nameServers: z.name_servers || [],
    originalNameServers: z.original_name_servers || [],
    plan: z.plan ? z.plan.name : null,
    account: z.account ? { id: z.account.id, name: z.account.name } : null,
    createdOn: z.created_on,
    modifiedOn: z.modified_on,
  };
}

export function zoneCommand() {
  const cmd = new Command('zone');
  cmd.description('Zone operations');

  // ── list ──────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('list').description('List all zones (all pages)')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));

    const zones = [];
    let page = 1;
    let totalPages = 1;
    do {
      const resp = await client.get(`zones?per_page=50&page=${page}`);
      const results = resp.result || [];
      for (const z of results) zones.push(shapeZone(z));
      if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
      page++;
    } while (page <= totalPages);

    out.heading('Zones');
    if (runtime.interactive) {
      if (!zones.length) {
        out.dim('(no zones)');
      } else {
        for (const z of zones) {
          out.info(`${(z.status || '').padEnd(8)} ${z.id}  ${z.name}`);
        }
        out.dim(`${zones.length} total`);
      }
    }
    out.set('zones', zones);
    out.set('total', zones.length);
    out.flush();
  });

  // ── get ───────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('get')
      .description('Get a zone by domain name')
      .requiredOption('--name <domain>', 'Domain name')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));

    const resp = await client.get(
      `zones?name=${encodeURIComponent(opts.name)}&per_page=1`
    );
    const zones = resp.result || [];
    if (zones.length === 0) {
      const err = new Error(`Zone not found: ${opts.name}`);
      err.code = 'zone_not_found';
      err.detail = { name: opts.name };
      throw err;
    }
    const shaped = shapeZone(zones[0]);

    out.heading('Zone');
    if (runtime.interactive) {
      out.info(`ID:     ${shaped.id}`);
      out.info(`Name:   ${shaped.name}`);
      out.info(`Status: ${shaped.status}`);
      if (shaped.plan) out.info(`Plan:   ${shaped.plan}`);
      if (shaped.nameServers.length) {
        out.info(`NS:     ${shaped.nameServers.join(', ')}`);
      }
    }
    out.set('zone', shaped);
    out.flush();
  });

  // ── create ────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('create')
      .description('Create a new zone (requires --account-id)')
      .requiredOption('--name <domain>', 'Domain name to add')
      .option('--jump-start', 'Enable DNS record auto-import (default: true)', true)
      .option('--no-jump-start', 'Disable DNS record auto-import')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const creds = resolveCredentials(opts);
    requireAccountId(creds);
    const client = createCloudflareClient(creds);

    const resp = await client.post('zones', {
      name: opts.name,
      account: { id: creds.accountId },
      jump_start: opts.jumpStart !== false,
    });
    const shaped = shapeZone(resp.result || {});

    out.heading('Zone created');
    if (runtime.interactive) {
      out.success(`Created zone: ${shaped.name}`);
      out.info(`ID:     ${shaped.id}`);
      out.info(`Status: ${shaped.status}`);
      if (shaped.nameServers.length) {
        out.info(`NS:     ${shaped.nameServers.join(', ')}`);
      }
    }
    out.set('zone', shaped);
    out.flush();
  });

  return cmd;
}
