/**
 * `cloudflare accounts` subcommands: list, catalog.
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

function shapeAccount(a) {
  return {
    id: a.id,
    name: a.name,
    type: a.type || null,
    createdOn: a.created_on || null,
    settings: a.settings || null,
  };
}

export function accountsCommand() {
  const cmd = new Command('accounts');
  cmd.description('Account operations');

  // ── list ──────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('list').description('List all accounts (all pages)')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));

    const accounts = [];
    let page = 1;
    let totalPages = 1;
    do {
      const resp = await client.get(`accounts?per_page=50&page=${page}`);
      const results = resp.result || [];
      for (const a of results) accounts.push(shapeAccount(a));
      if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
      page++;
    } while (page <= totalPages);

    out.heading('Accounts');
    if (runtime.interactive) {
      if (!accounts.length) {
        out.dim('(no accounts)');
      } else {
        for (const a of accounts) {
          out.info(`${a.id}  ${a.name}`);
        }
        out.dim(`${accounts.length} total`);
      }
    }
    out.set('accounts', accounts);
    out.set('total', accounts.length);
    out.flush();
  });

  // ── catalog ───────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('catalog')
      .description('Catalog all zones and DNS records for an account (requires --account-id)')
      .option('--zone <pattern>', 'Zone name filter (supports * and ? wildcards)')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const creds = resolveCredentials(opts);
    requireAccountId(creds);
    const client = createCloudflareClient(creds);

    const accountId = creds.accountId;

    // Fetch all zones for the account
    const zones = [];
    let page = 1;
    let totalPages = 1;
    do {
      const resp = await client.get(
        `zones?account.id=${accountId}&per_page=50&page=${page}`
      );
      const results = resp.result || [];
      for (const z of results) zones.push(z);
      if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
      page++;
    } while (page <= totalPages);

    // Filter zones by pattern if provided
    let filtered = zones;
    if (opts.zone) {
      const re = globToRegex(opts.zone);
      filtered = zones.filter((z) => re.test(z.name));
    }

    if (filtered.length === 0) {
      const err = new Error('No zones found matching the given criteria');
      err.code = 'no_zones_found';
      err.detail = { accountId, zonePattern: opts.zone || null };
      throw err;
    }

    // Fetch DNS records for each zone
    const catalog = [];
    for (const zone of filtered) {
      const dnsRecords = [];
      let dnsPage = 1;
      let dnsTotalPages = 1;
      do {
        const resp = await client.get(
          `zones/${zone.id}/dns_records?per_page=100&page=${dnsPage}`
        );
        const results = resp.result || [];
        for (const r of results) dnsRecords.push(r);
        if (resp.result_info) dnsTotalPages = resp.result_info.total_pages || 1;
        dnsPage++;
      } while (dnsPage <= dnsTotalPages);

      catalog.push({
        zone: { id: zone.id, name: zone.name, status: zone.status },
        dnsRecords: dnsRecords.length,
        records: dnsRecords.map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          content: r.content,
          proxied: r.proxied,
          ttl: r.ttl,
        })),
      });
    }

    out.heading('Account Catalog');
    if (runtime.interactive) {
      for (const entry of catalog) {
        out.info(`${entry.zone.name} (${entry.zone.status}) — ${entry.dnsRecords} DNS record(s)`);
        for (const r of entry.records) {
          out.info(`  ${r.type.padEnd(8)} ${r.name}  →  ${r.content}`);
        }
      }
      out.dim(`${catalog.length} zone(s), ${catalog.reduce((s, e) => s + e.dnsRecords, 0)} record(s)`);
    }
    out.set('catalog', catalog);
    out.set('totalZones', catalog.length);
    out.set('totalRecords', catalog.reduce((s, e) => s + e.dnsRecords, 0));
    out.flush();
  });

  return cmd;
}

// ── Helpers ──────────────────────────────────────────────────────────

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${withWildcards}$`);
}
