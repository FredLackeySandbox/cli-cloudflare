# @fredlackey/cli-cloudflare

Command-line interface for [Cloudflare](https://www.cloudflare.com) zone, DNS, and API token management. JSON output by default so AI agents and scripts can consume it directly, with a human-friendly mode when you're working interactively.

## Install

```
npm install -g @fredlackey/cli-cloudflare
```

## Usage

Every command accepts credentials directly as flags. No setup step is required.

```
cloudflare zone list --api-token <token>
cloudflare zone list --api-key <token>
cloudflare dns list --zone example.com --api-token <token>
cloudflare catalog --path ./catalogs --account <id> --zone example.com --api-key <token>
cloudflare catalog --path ./catalogs --account <id> --mode full --zone example.com --api-key <token>
cloudflare dns create \
  --api-token <token> \
  --zone example.com \
  --type A \
  --name www \
  --content 192.168.1.1
```

For `catalog`, you must pass either one or more exact `--zone` values or explicit `--all`.

If you've already run `cloudflare configure`, you can omit the credential flags:

```
cloudflare zone list
cloudflare catalog --path ./catalogs --account-id <id> --zone example.com --zone example.net
cloudflare catalog --path ./catalogs --account-id <id> --mode full --zone example.com
cloudflare catalog --path ./catalogs --account-id <id> --all
cloudflare token verify
```

`--mode simple` is the default and writes one JSON file per selected zone at:

```
<path>/<datestamp>/<zone>.json
```

`--mode full` writes:

```
<path>/<datestamp>/zones.json
<path>/<datestamp>/zones/<zone>/zone-details.json
<path>/<datestamp>/zones/<zone>/zone-settings.json
<path>/<datestamp>/zones/<zone>/page-rules.json
<path>/<datestamp>/zones/<zone>/dns-records.json
```

The `full` layout matches the existing `.data/cloudflare-cli/catalog/...` structure.

## Configure (Optional)

**The `configure` command is optional.** Every command accepts credentials directly as flags. `--api-token` and `--api-key` are interchangeable. `--account-id` and `--account` are interchangeable. You never need to run `configure` to use this tool. It exists as a convenience so you don't have to pass the same flags on every invocation.

```
cloudflare configure \
  --api-token <token> \
  --account-id <id>
```

Running `cloudflare configure` without flags prompts for each value interactively. Credentials are stored in `~/.config/cli-cloudflare/config.json` and that file is the only config source. There are no environment variables to set.

To remove the saved config file:

```
cloudflare configure --reset
```

If a required credential is missing at runtime, the error tells you exactly what to do:

```json
{
  "error": "Missing required value: --api-token or --api-key. Pass it as a flag or run \"cloudflare configure\"."
}
```

## Full Command Reference

For the complete list of commands and flags, see [COMMANDS.md](COMMANDS.md).

## Output

All commands write JSON to stdout by default. When run in an interactive terminal, output switches to a human-friendly format with colors. Use the global `--json` and `--interactive` flags to override the auto-detection.

## Contributing

If you find a gap or have a feature request, open an issue or submit a pull request on [GitHub](https://github.com/FredLackeySandbox/cli-cloudflare).

## Questions?

If you have questions, comments, or just want to talk shop, feel free to reach out.

Fred Lackey  
[fred.lackey@gmail.com](mailto:fred.lackey@gmail.com)  
[https://fredlackey.com](https://fredlackey.com)  

## License

Apache-2.0
