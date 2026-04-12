# @fredlackey/cli-cloudflare

Command-line interface for [Cloudflare](https://www.cloudflare.com) zone, DNS, and API token management. JSON output by default so AI agents and scripts can consume it directly, with a human-friendly mode when you're working interactively.

## Install

```
npm install -g @fredlackey/cli-cloudflare
```

## Configure

```
cloudflare configure \
  --api-token <token> \
  --account-id <id>
```

Running `cloudflare configure` without flags prompts for each value interactively. Credentials are stored in `~/.config/cli-cloudflare/config.json` and that file is the only config source. There are no environment variables to set.

## Usage

```
cloudflare zone list
cloudflare dns list --zone example.com
cloudflare dns create \
  --zone example.com \
  --type A \
  --name www \
  --content 192.168.1.1
cloudflare accounts catalog --zone "*.com"
cloudflare token verify
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
