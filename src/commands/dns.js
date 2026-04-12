/**
 * `cloudflare dns` subcommands: list, get, create, update, delete.
 *
 * Every subcommand accepts the credential flags and a --zone flag that may
 * be a domain name or a 32-char hex zone ID. Domain names are resolved to
 * zone IDs via the Cloudflare API.
 *
 * Repo rule: the `--proxied` flag exists for completeness but records
 * default to DNS-only. Set --proxied explicitly to enable the orange cloud.
 */

import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import { resolveCredentials } from '../utils/config.js';
import {
  createCloudflareClient,
  withCredentialOptions,
  resolveZoneId,
} from '../utils/cloudflare-client.js';

function shapeRecord(r) {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: r.proxied || false,
    priority: r.priority ?? null,
    createdOn: r.created_on,
    modifiedOn: r.modified_on,
  };
}

export function dnsCommand() {
  const cmd = new Command('dns');
  cmd.description('DNS record operations');

  // ── list ──────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('list')
      .description('List all DNS records for a zone (all pages)')
      .requiredOption('--zone <domain-or-id>', 'Domain name or zone ID')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));
    const zoneId = await resolveZoneId(client, opts.zone);

    const records = [];
    let page = 1;
    let totalPages = 1;
    do {
      const resp = await client.get(
        `zones/${zoneId}/dns_records?per_page=50&page=${page}`
      );
      const results = resp.result || [];
      for (const r of results) records.push(shapeRecord(r));
      if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
      page++;
    } while (page <= totalPages);

    out.heading('DNS records');
    if (runtime.interactive) {
      if (!records.length) {
        out.dim('(no records)');
      } else {
        for (const r of records) {
          out.info(`${r.type.padEnd(6)} ${r.name}  \u2192  ${r.content}`);
        }
        out.dim(`${records.length} total`);
      }
    }
    out.set('zoneId', zoneId);
    out.set('records', records);
    out.set('total', records.length);
    out.flush();
  });

  // ── get ───────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('get')
      .description('Get a single DNS record by ID')
      .requiredOption('--zone <domain-or-id>', 'Domain name or zone ID')
      .requiredOption('--id <record-id>', 'DNS record ID')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));
    const zoneId = await resolveZoneId(client, opts.zone);

    const resp = await client.get(`zones/${zoneId}/dns_records/${opts.id}`);
    const shaped = shapeRecord(resp.result || {});

    out.heading('DNS record');
    if (runtime.interactive) {
      out.info(`ID:       ${shaped.id}`);
      out.info(`Type:     ${shaped.type}`);
      out.info(`Name:     ${shaped.name}`);
      out.info(`Content:  ${shaped.content}`);
      out.info(`TTL:      ${shaped.ttl}`);
      out.info(`Proxied:  ${shaped.proxied}`);
      if (shaped.priority !== null) out.info(`Priority: ${shaped.priority}`);
    }
    out.set('record', shaped);
    out.flush();
  });

  // ── create ────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('create')
      .description('Create a DNS record')
      .requiredOption('--zone <domain-or-id>', 'Domain name or zone ID')
      .requiredOption('--type <type>', 'Record type (A, AAAA, CNAME, MX, TXT, etc.)')
      .requiredOption('--name <name>', 'Record name (@ for root)')
      .requiredOption('--content <content>', 'Record content (IP, hostname, text)')
      .option('--ttl <seconds>', 'TTL in seconds (1 = auto)', '1')
      .option('--priority <n>', 'Priority (for MX/SRV records)')
      .option('--proxied', 'Enable Cloudflare proxy (orange cloud)', false)
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));
    const zoneId = await resolveZoneId(client, opts.zone);

    const body = {
      type: opts.type.toUpperCase(),
      name: opts.name,
      content: opts.content,
      ttl: parseInt(opts.ttl, 10) || 1,
      proxied: Boolean(opts.proxied),
    };
    if (opts.priority !== undefined) body.priority = parseInt(opts.priority, 10);

    const resp = await client.post(`zones/${zoneId}/dns_records`, body);
    const shaped = shapeRecord(resp.result || {});

    out.heading('DNS record created');
    if (runtime.interactive) {
      out.success(`Created ${shaped.type} ${shaped.name} \u2192 ${shaped.content}`);
      out.info(`ID: ${shaped.id}`);
    }
    out.set('zoneId', zoneId);
    out.set('record', shaped);
    out.flush();
  });

  // ── update ────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('update')
      .description('Update a DNS record (full replacement via PUT)')
      .requiredOption('--zone <domain-or-id>', 'Domain name or zone ID')
      .requiredOption('--id <record-id>', 'DNS record ID to update')
      .requiredOption('--type <type>', 'Record type')
      .requiredOption('--name <name>', 'Record name')
      .requiredOption('--content <content>', 'Record content')
      .option('--ttl <seconds>', 'TTL in seconds (1 = auto)', '1')
      .option('--priority <n>', 'Priority (for MX/SRV records)')
      .option('--proxied', 'Enable Cloudflare proxy', false)
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));
    const zoneId = await resolveZoneId(client, opts.zone);

    const body = {
      type: opts.type.toUpperCase(),
      name: opts.name,
      content: opts.content,
      ttl: parseInt(opts.ttl, 10) || 1,
      proxied: Boolean(opts.proxied),
    };
    if (opts.priority !== undefined) body.priority = parseInt(opts.priority, 10);

    const resp = await client.put(`zones/${zoneId}/dns_records/${opts.id}`, body);
    const shaped = shapeRecord(resp.result || {});

    out.heading('DNS record updated');
    if (runtime.interactive) {
      out.success(`Updated ${shaped.type} ${shaped.name} \u2192 ${shaped.content}`);
    }
    out.set('zoneId', zoneId);
    out.set('record', shaped);
    out.flush();
  });

  // ── delete ────────────────────────────────────────────────────────
  withCredentialOptions(
    cmd.command('delete')
      .description('Delete a DNS record by ID')
      .requiredOption('--zone <domain-or-id>', 'Domain name or zone ID')
      .requiredOption('--id <record-id>', 'DNS record ID to delete')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const client = createCloudflareClient(resolveCredentials(opts));
    const zoneId = await resolveZoneId(client, opts.zone);

    const resp = await client.delete(`zones/${zoneId}/dns_records/${opts.id}`);
    const deletedId = (resp && resp.result && resp.result.id) || opts.id;

    out.heading('DNS record deleted');
    if (runtime.interactive) {
      out.success(`Deleted record ${deletedId}`);
    }
    out.set('zoneId', zoneId);
    out.set('id', deletedId);
    out.set('deleted', true);
    out.flush();
  });

  return cmd;
}
