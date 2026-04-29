# Commands

## Global flags

The following flags can be placed before any subcommand:

| Flag | Description |
|---|---|
| `--json` | Force JSON output (default when stdout is not a TTY) |
| `--interactive` | Force interactive/human-friendly output |

## Credential flags

Every subcommand (except `configure`) accepts these credential flags. They are optional if you have already run `cloudflare configure` to save credentials to `~/.config/cli-cloudflare/config.json`.

| Flag | Description |
|---|---|
| `--api-token <token>` | Cloudflare API token |
| `--account-id <id>` | Cloudflare account ID (required for some ops) |
| `--api-base-url <url>` | Cloudflare API base URL |

---

## Catalog

Write one JSON file per zone under `{path}/{datestamp}/`.

### catalog

```
cloudflare catalog --path <dir> [--date <YYYYMMDD|YYYYMMDDHHmm|YYYYMMDDHHmmss>] [--zone <pattern>] [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--path <dir>` | Yes | Base directory where catalog files should be written |
| `--date <stamp>` | No | Date stamp in `YYYYMMDD`, `YYYYMMDDHHmm`, or `YYYYMMDDHHmmss` format. Defaults to the current local timestamp in `YYYYMMDDHHmmss`. |
| `--zone <pattern>` | No | Zone name filter (supports `*` and `?` wildcards) |

The command creates files like:

```
<path>/<datestamp>/<zone>.json
```

Each file contains the same per-zone payload shape used by `accounts catalog`:
zone metadata, `dnsRecords` count, and the full `records` array.

---

## Accounts

Account operations.

### accounts list

List all accounts (all pages).

```
cloudflare accounts list [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

### accounts catalog

Catalog all zones and DNS records for an account (requires `--account-id`).

```
cloudflare accounts catalog [--api-token <token>] [--account-id <id>] [--api-base-url <url>] [--zone <pattern>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <pattern>` | No | Zone name filter (supports `*` and `?` wildcards) |

---

## Configure

Write Cloudflare credentials to `~/.config/cli-cloudflare/config.json`.

### configure

```
cloudflare configure [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--api-token <token>` | No | Cloudflare API token |
| `--account-id <id>` | No | Cloudflare account ID (optional) |
| `--api-base-url <url>` | No | Cloudflare API base URL (optional) |

In interactive mode (TTY), missing values are prompted for. The API token is required but can be supplied interactively instead of via flag.

---

## DNS

DNS record operations.

### dns list

List all DNS records for a zone (all pages).

```
cloudflare dns list --zone <domain-or-id> [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <domain-or-id>` | Yes | Domain name or zone ID |

### dns get

Get a single DNS record by ID.

```
cloudflare dns get --zone <domain-or-id> --id <record-id> [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <domain-or-id>` | Yes | Domain name or zone ID |
| `--id <record-id>` | Yes | DNS record ID |

### dns create

Create a DNS record.

```
cloudflare dns create --zone <domain-or-id> --type <type> --name <name> --content <content> [--ttl <seconds>] [--priority <n>] [--proxied] [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <domain-or-id>` | Yes | Domain name or zone ID |
| `--type <type>` | Yes | Record type (A, AAAA, CNAME, MX, TXT, etc.) |
| `--name <name>` | Yes | Record name (@ for root) |
| `--content <content>` | Yes | Record content (IP, hostname, text) |
| `--ttl <seconds>` | No | TTL in seconds (1 = auto, default: 1) |
| `--priority <n>` | No | Priority (for MX/SRV records) |
| `--proxied` | No | Enable Cloudflare proxy / orange cloud (default: false) |

### dns update

Update a DNS record (full replacement via PUT).

```
cloudflare dns update --zone <domain-or-id> --id <record-id> --type <type> --name <name> --content <content> [--ttl <seconds>] [--priority <n>] [--proxied] [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <domain-or-id>` | Yes | Domain name or zone ID |
| `--id <record-id>` | Yes | DNS record ID to update |
| `--type <type>` | Yes | Record type |
| `--name <name>` | Yes | Record name |
| `--content <content>` | Yes | Record content |
| `--ttl <seconds>` | No | TTL in seconds (1 = auto, default: 1) |
| `--priority <n>` | No | Priority (for MX/SRV records) |
| `--proxied` | No | Enable Cloudflare proxy (default: false) |

### dns delete

Delete a DNS record by ID.

```
cloudflare dns delete --zone <domain-or-id> --id <record-id> [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--zone <domain-or-id>` | Yes | Domain name or zone ID |
| `--id <record-id>` | Yes | DNS record ID to delete |

---

## Token

API token operations.

### token verify

Verify the active API token.

```
cloudflare token verify [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

### token list-permissions

List available API token permission groups (requires `--account-id`).

```
cloudflare token list-permissions [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

---

## Zone

Zone operations.

### zone list

List all zones (all pages).

```
cloudflare zone list [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

### zone get

Get a zone by domain name.

```
cloudflare zone get --name <domain> [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--name <domain>` | Yes | Domain name |

### zone create

Create a new zone (requires `--account-id`).

```
cloudflare zone create --name <domain> [--jump-start] [--no-jump-start] [--api-token <token>] [--account-id <id>] [--api-base-url <url>]
```

| Flag | Required | Description |
|---|---|---|
| `--name <domain>` | Yes | Domain name to add |
| `--jump-start` | No | Enable DNS record auto-import (default: true) |
| `--no-jump-start` | No | Disable DNS record auto-import |
