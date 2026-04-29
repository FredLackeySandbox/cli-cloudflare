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
 * HTTP-layer failures may additionally carry `err.httpStatus` /
 * `err.httpBody` or the legacy `err.response.status` /
 * `err.response.data` shape.
 */

import chalk from 'chalk';
import { getRuntime } from './runtime.js';

export function fatalError(err) {
  const runtime = getRuntime();
  const httpStatus = err?.httpStatus ?? err?.response?.status;
  const httpBody = err?.httpBody ?? err?.response?.data;

  if (runtime.json) {
    const payload = {
      error: err?.message || String(err),
    };
    if (err?.code) payload.code = err.code;
    if (err?.detail !== undefined) payload.detail = err.detail;
    if (httpStatus) payload.httpStatus = httpStatus;
    if (httpBody !== undefined) payload.httpBody = httpBody;
    process.stderr.write(JSON.stringify(payload) + '\n');
  } else {
    const msg = err?.message || String(err);
    process.stderr.write(chalk.red('Error: ') + msg + '\n');
    if (httpBody !== undefined) {
      const body = typeof httpBody === 'string'
        ? httpBody
        : JSON.stringify(httpBody, null, 2);
      process.stderr.write(chalk.dim(body) + '\n');
    }
  }

  process.exit(1);
}
