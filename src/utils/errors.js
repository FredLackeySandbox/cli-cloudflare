/**
 * Fatal error emission.
 *
 * Called from the top-level parseAsync catch in index.js. A thrown error
 * from any command action ends up here. In JSON mode we emit a structured
 * JSON object on stderr so an agent can parse the failure. In interactive
 * mode we emit a colored message.
 *
 * Either way, the process exits 1.
 *
 * Errors may carry extra metadata via `err.code` and `err.detail`.
 * Errors from axios additionally carry `err.response.status` and
 * `err.response.data` which get unwrapped into `httpStatus` / `httpBody`.
 */

import chalk from 'chalk';
import { getRuntime } from './runtime.js';

export function fatalError(err) {
  const runtime = getRuntime();

  if (runtime.json) {
    const payload = {
      error: err?.message || String(err),
    };
    if (err?.code) payload.code = err.code;
    if (err?.detail !== undefined) payload.detail = err.detail;
    if (err?.response?.status) payload.httpStatus = err.response.status;
    if (err?.response?.data !== undefined) payload.httpBody = err.response.data;
    process.stderr.write(JSON.stringify(payload) + '\n');
  } else {
    const msg = err?.message || String(err);
    process.stderr.write(chalk.red('Error: ') + msg + '\n');
    if (err?.response?.data !== undefined) {
      const body = typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data, null, 2);
      process.stderr.write(chalk.dim(body) + '\n');
    }
  }

  process.exit(1);
}
