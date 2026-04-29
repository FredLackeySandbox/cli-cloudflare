/**
 * `cloudflare catalog`
 *
 * Fetch all zones and DNS records for an account and write one JSON file per
 * zone under: {path}/{datestamp}/{zone}.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Command } from 'commander';
import { getRuntime } from '../utils/runtime.js';
import { createOutput } from '../utils/output.js';
import { resolveCredentials, requireAccountId } from '../utils/config.js';
import {
  createCloudflareClient,
  withCredentialOptions,
} from '../utils/cloudflare-client.js';

export function catalogCommand() {
  return withCredentialOptions(
    new Command('catalog')
      .description('Write per-zone catalog JSON files under {path}/{datestamp}/ (requires --account-id)')
      .requiredOption('--path <dir>', 'Base directory where catalog files should be written')
      .option('--date <stamp>', 'Date stamp in YYYYMMDD, YYYYMMDDHHmm, or YYYYMMDDHHmmss format')
      .option('--zone <pattern>', 'Zone name filter (supports * and ? wildcards)')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const creds = resolveCredentials(opts);
    requireAccountId(creds);
    const client = createCloudflareClient(creds);

    const stamp = resolveDateStamp(opts.date);
    const targetDir = path.join(opts.path, stamp);

    const zones = await fetchZones(client, creds.accountId);
    const filtered = filterZones(zones, opts.zone);

    if (filtered.length === 0) {
      const err = new Error('No zones found matching the given criteria');
      err.code = 'no_zones_found';
      err.detail = { accountId: creds.accountId, zonePattern: opts.zone || null };
      throw err;
    }

    await fs.mkdir(targetDir, { recursive: true });

    let totalRecords = 0;
    const files = [];

    for (const zone of filtered) {
      const records = await fetchDnsRecords(client, zone.id);
      totalRecords += records.length;

      const payload = {
        zone: { id: zone.id, name: zone.name, status: zone.status },
        dnsRecords: records.length,
        records: records.map((r) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          content: r.content,
          proxied: r.proxied,
          ttl: r.ttl,
        })),
      };

      const filePath = path.join(targetDir, `${zone.name}.json`);
      await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
      files.push({
        zone: zone.name,
        path: filePath,
        dnsRecords: records.length,
      });

      if (runtime.interactive) {
        out.info(`Wrote ${zone.name}.json (${records.length} DNS record(s))`);
      }
    }

    if (runtime.interactive) {
      out.dim(`${files.length} zone(s), ${totalRecords} record(s), path: ${targetDir}`);
    }

    out.set('path', targetDir);
    out.set('dateStamp', stamp);
    out.set('files', files);
    out.set('totalZones', files.length);
    out.set('totalRecords', totalRecords);
    out.flush();
  });
}

async function fetchZones(client, accountId) {
  const zones = [];
  let page = 1;
  let totalPages = 1;

  do {
    const resp = await client.get(
      `zones?account.id=${accountId}&per_page=50&page=${page}`
    );
    const results = resp.result || [];
    for (const zone of results) zones.push(zone);
    if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
    page++;
  } while (page <= totalPages);

  return zones;
}

function filterZones(zones, pattern) {
  if (!pattern) return zones;
  const re = globToRegex(pattern);
  return zones.filter((zone) => re.test(zone.name));
}

async function fetchDnsRecords(client, zoneId) {
  const records = [];
  let page = 1;
  let totalPages = 1;

  do {
    const resp = await client.get(
      `zones/${zoneId}/dns_records?per_page=100&page=${page}`
    );
    const results = resp.result || [];
    for (const record of results) records.push(record);
    if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
    page++;
  } while (page <= totalPages);

  return records;
}

function resolveDateStamp(value) {
  if (value === undefined || value === null || value === '') {
    return formatNow();
  }

  if (!/^\d{8}(\d{4}|\d{6})?$/.test(value)) {
    const err = new Error('Invalid --date value. Expected YYYYMMDD, YYYYMMDDHHmm, or YYYYMMDDHHmmss.');
    err.code = 'invalid_date_stamp';
    err.detail = { value };
    throw err;
  }

  return value;
}

function formatNow() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${withWildcards}$`);
}
