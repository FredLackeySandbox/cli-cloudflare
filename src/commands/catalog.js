/**
 * `cloudflare catalog`
 *
 * Fetch selected zones for an account and write either:
 *   - simple mode: one JSON file per zone under {path}/{datestamp}/{zone}.json
 *   - full mode: a catalog tree under {path}/{datestamp}/ matching the
 *     existing .data/cloudflare-cli/catalog layout
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
      .description('Write a zone catalog under {path}/{datestamp}/ in simple or full mode (requires --account-id and either --zone or --all)')
      .requiredOption('--path <dir>', 'Base directory where catalog files should be written')
      .option('--date <stamp>', 'Date stamp in YYYYMMDD, YYYYMMDDHHmm, or YYYYMMDDHHmmss format')
      .option('--mode <mode>', 'Catalog output mode: simple or full', 'simple')
      .option('--zone <name-or-id>', 'Zone name or zone ID to catalog; repeat to include multiple zones', collectValues, [])
      .option('--all', 'Catalog all zones for the account')
  ).action(async (opts) => {
    const runtime = getRuntime();
    const out = createOutput(runtime);
    const creds = resolveCredentials(opts);
    requireAccountId(creds);
    const client = createCloudflareClient(creds);

    const stamp = resolveDateStamp(opts.date);
    const targetDir = path.join(opts.path, stamp);

    validateMode(opts.mode);
    validateCatalogSelection(opts);

    const zones = await fetchZones(client, creds.accountId);
    const filtered = selectZones(zones, opts);

    if (filtered.length === 0) {
      const err = new Error('No zones found matching the given criteria');
      err.code = 'no_zones_found';
      err.detail = {
        accountId: creds.accountId,
        all: Boolean(opts.all),
        zones: opts.zone,
      };
      throw err;
    }

    await fs.mkdir(targetDir, { recursive: true });

    const result = opts.mode === 'full'
      ? await writeFullCatalog(client, creds.accountId, filtered, targetDir, runtime, out)
      : await writeSimpleCatalog(client, filtered, targetDir, runtime, out);

    if (runtime.interactive) {
      out.dim(`${result.totalZones} zone(s), ${result.totalRecords} record(s), path: ${targetDir}`);
    }

    out.set('path', targetDir);
    out.set('dateStamp', stamp);
    out.set('mode', opts.mode);
    out.set('files', result.files);
    out.set('totalZones', result.totalZones);
    out.set('totalRecords', result.totalRecords);
    out.set('all', Boolean(opts.all));
    out.set('zones', opts.zone);
    out.flush();
  });
}

async function writeSimpleCatalog(client, zones, targetDir, runtime, out) {
  let totalRecords = 0;
  const files = [];

  for (const zone of zones) {
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
    await writeJsonFile(filePath, payload);
    files.push({
      zone: zone.name,
      path: filePath,
      dnsRecords: records.length,
    });

    if (runtime.interactive) {
      out.info(`Wrote ${zone.name}.json (${records.length} DNS record(s))`);
    }
  }

  return { files, totalZones: files.length, totalRecords };
}

async function writeFullCatalog(client, accountId, zones, targetDir, runtime, out) {
  const zonesDir = path.join(targetDir, 'zones');
  await fs.mkdir(zonesDir, { recursive: true });

  let totalRecords = 0;
  const files = [];
  const scannedAt = new Date().toISOString();

  await writeJsonFile(
    path.join(targetDir, 'zones.json'),
    buildResourceEnvelope(accountId, null, 'zones', scannedAt, zones)
  );

  for (const zone of zones) {
    const zoneDir = path.join(zonesDir, zone.name);
    await fs.mkdir(zoneDir, { recursive: true });

    const [zoneDetails, zoneSettings, pageRules, dnsRecords] = await Promise.all([
      fetchZoneDetails(client, zone.id),
      fetchZoneSettings(client, zone.id),
      fetchPageRules(client, zone.id),
      fetchDnsRecords(client, zone.id),
    ]);

    totalRecords += dnsRecords.length;

    const outputs = [
      { name: 'zone-details', file: 'zone-details.json', items: [zoneDetails] },
      { name: 'zone-settings', file: 'zone-settings.json', items: zoneSettings },
      { name: 'page-rules', file: 'page-rules.json', items: pageRules },
      { name: 'dns-records', file: 'dns-records.json', items: dnsRecords },
    ];

    for (const output of outputs) {
      await writeJsonFile(
        path.join(zoneDir, output.file),
        buildResourceEnvelope(accountId, zone.id, output.name, new Date().toISOString(), output.items)
      );
      files.push({
        zone: zone.name,
        resource: output.name,
        path: path.join(zoneDir, output.file),
        count: output.items.length,
      });
    }

    if (runtime.interactive) {
      out.info(`Wrote ${zone.name}/ (${dnsRecords.length} DNS record(s), ${pageRules.length} page rule(s))`);
    }
  }

  files.unshift({
    zone: null,
    resource: 'zones',
    path: path.join(targetDir, 'zones.json'),
    count: zones.length,
  });

  return { files, totalZones: zones.length, totalRecords };
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

async function fetchZoneDetails(client, zoneId) {
  const resp = await client.get(`zones/${zoneId}`);
  return resp.result || null;
}

async function fetchZoneSettings(client, zoneId) {
  const resp = await client.get(`zones/${zoneId}/settings`);
  return resp.result || [];
}

async function fetchPageRules(client, zoneId) {
  const rules = [];
  let page = 1;
  let totalPages = 1;

  do {
    const resp = await client.get(
      `zones/${zoneId}/pagerules?per_page=100&page=${page}`
    );
    const results = resp.result || [];
    for (const rule of results) rules.push(rule);
    if (resp.result_info) totalPages = resp.result_info.total_pages || 1;
    page++;
  } while (page <= totalPages);

  return rules;
}

function selectZones(zones, opts) {
  if (opts.all) return zones;

  const requested = new Set((opts.zone || []).map((value) => value.trim()).filter(Boolean));
  return zones.filter((zone) => requested.has(zone.name) || requested.has(zone.id));
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

function buildResourceEnvelope(accountId, zoneId, resource, scannedAt, items) {
  return {
    account: accountId,
    zone: zoneId,
    resource,
    scannedAt,
    count: items.length,
    items,
  };
}

async function writeJsonFile(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function collectValues(value, previous) {
  previous.push(value);
  return previous;
}

function validateMode(mode) {
  if (mode === 'simple' || mode === 'full') return;

  const err = new Error('Invalid --mode value. Expected "simple" or "full".');
  err.code = 'invalid_mode';
  err.detail = { mode };
  throw err;
}

function validateCatalogSelection(opts) {
  const zones = (opts.zone || []).filter(Boolean);
  if (opts.all && zones.length) {
    const err = new Error('Pass either --all or one or more --zone values, not both.');
    err.code = 'invalid_catalog_selection';
    err.detail = { all: true, zones };
    throw err;
  }

  if (!opts.all && zones.length === 0) {
    const err = new Error('Pass one or more --zone values or use --all.');
    err.code = 'invalid_catalog_selection';
    err.detail = { all: false, zones: [] };
    throw err;
  }
}
